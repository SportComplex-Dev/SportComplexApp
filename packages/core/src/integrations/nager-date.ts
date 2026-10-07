import ky from "ky";
import { findFestivosByYear, upsertManyFestivos } from "@sportcomplex/db";

// Cliente Nager.Date CO con timeout estricto de 2.5s + fallback a tabla FESTIVO (ARCHITECTURE §9.4 / SCRUM-103)
const BASE = process.env.NAGER_DATE_BASE_URL ?? "https://date.nager.at/api/v3";
export const STRICT_TIMEOUT_MS = 2500; // 2.5 segundos

export interface NagerHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
}

/**
 * Interfaz para el almacén de caché de festivos (permite inyección de dependencias para testing o persistencia).
 */
export interface HolidayCacheStore {
  getByYear(year: number): Promise<NagerHoliday[] | Array<{ fecha: Date | string; nombre: string; anio?: number }>>;
  saveHolidays(holidays: NagerHoliday[], year: number): Promise<void>;
}

/**
 * Normaliza cualquier registro de festivo (DB o API) al formato estándar NagerHoliday.
 */
function normalizeToNagerHoliday(
  raw: NagerHoliday | { fecha: Date | string; nombre: string; anio?: number },
): NagerHoliday {
  if ("date" in raw && typeof raw.date === "string") {
    return {
      date: raw.date.slice(0, 10),
      localName: raw.localName ?? raw.name ?? "",
      name: raw.name ?? raw.localName ?? "",
    };
  }

  const dbRecord = raw as { fecha: Date | string; nombre: string };
  const dateStr =
    dbRecord.fecha instanceof Date
      ? dbRecord.fecha.toISOString().slice(0, 10)
      : String(dbRecord.fecha).slice(0, 10);

  return {
    date: dateStr,
    localName: dbRecord.nombre,
    name: dbRecord.nombre,
  };
}

/**
 * Implementación de HolidayCacheStore sobre la tabla relacional `festivo` en @sportcomplex/db.
 * Gestiona errores de conexión para no degradar el servicio si la BD tiene latencia o desconexión.
 */
export const dbHolidayCacheStore: HolidayCacheStore = {
  async getByYear(year: number): Promise<NagerHoliday[]> {
    try {
      const records = await findFestivosByYear(year);
      return records.map((r) => normalizeToNagerHoliday(r));
    } catch (error) {
      console.warn(
        `[nager-date] Fallo al consultar tabla FESTIVO en DB para el año ${year}:`,
        error instanceof Error ? error.message : error,
      );
      return [];
    }
  },

  async saveHolidays(holidays: NagerHoliday[], year: number): Promise<void> {
    if (!holidays || holidays.length === 0) return;
    try {
      await upsertManyFestivos(
        holidays.map((h) => ({
          fecha: h.date,
          nombre: h.localName || h.name,
          anio: year,
        })),
      );
    } catch (error) {
      console.warn(
        `[nager-date] Fallo al sincronizar festivos en tabla FESTIVO para el año ${year}:`,
        error instanceof Error ? error.message : error,
      );
    }
  },
};

export interface FetchHolidaysOptions {
  timeoutMs?: number;
  baseUrl?: string;
}

/**
 * Cliente HTTP contra https://date.nager.at/api/v3/PublicHolidays/{year}/CO.
 * Aplica un timeout estricto de 2.5 segundos (2500ms) sin retries que excedan el presupuesto temporal.
 *
 * @param {number} year - Año de consulta (ej. 2026)
 * @param {FetchHolidaysOptions} [options] - Configuración opcional de timeout o URL base
 * @returns {Promise<NagerHoliday[]>} Lista de festivos de Colombia
 */
export async function fetchColombiaHolidays(
  year: number,
  options?: FetchHolidaysOptions,
): Promise<NagerHoliday[]> {
  const baseUrl = options?.baseUrl ?? BASE;
  const timeoutMs = options?.timeoutMs ?? STRICT_TIMEOUT_MS;

  return ky
    .get(`${baseUrl}/PublicHolidays/${year}/CO`, {
      timeout: timeoutMs,
      retry: 0,
    })
    .json<NagerHoliday[]>();
}

export interface GetColombiaHolidaysOptions {
  cacheStore?: HolidayCacheStore;
  fetcher?: (year: number) => Promise<NagerHoliday[]>;
  timeoutMs?: number;
  baseUrl?: string;
  preferCache?: boolean;
  forceRefresh?: boolean;
}

/**
 * Motor de obtención de festivos con patrón Cache-Aside a la tabla FESTIVO y timeout estricto de 2.5s.
 * Garantiza resiliencia total: si la API externa cae o responde lento (>2.5s), recurre a la caché local
 * sin fallar ni interrumpir la disponibilidad de las reservas de piscina.
 *
 * Flujo Cache-Aside:
 * 1. Si `preferCache` es true y hay datos en caché (tabla FESTIVO) -> Responde desde la caché (0 latencia).
 * 2. Si hay Cache Miss o `preferCache` es false:
 *    - Invoca a la API con timeout estricto de 2.5s.
 *    - Si la API responde con éxito -> Guarda en caché (Cache-Aside write) y retorna.
 *    - Si la API cae o agota los 2.5s -> Captura el error y recurre al fallback de la tabla FESTIVO.
 *
 * @param {number} year - Año a consultar
 * @param {GetColombiaHolidaysOptions} [options] - Parámetros de caché y timeout
 * @returns {Promise<NagerHoliday[]>} Festivos obtenidos (desde API o caché)
 */
export async function getColombiaHolidays(
  year: number,
  options: GetColombiaHolidaysOptions = {},
): Promise<NagerHoliday[]> {
  const cache = options.cacheStore ?? dbHolidayCacheStore;
  const timeoutMs = options.timeoutMs ?? STRICT_TIMEOUT_MS;
  const baseUrl = options.baseUrl;
  const forceRefresh = options.forceRefresh ?? false;
  const preferCache = options.preferCache ?? true;

  // 1. Si preferCache está activo y no se fuerza refresco, intentamos leer de la caché primero
  if (preferCache && !forceRefresh) {
    const cached = await cache.getByYear(year).catch(() => []);
    if (cached && cached.length > 0) {
      return cached.map(normalizeToNagerHoliday);
    }
  }

  // 2. Cache Miss o preferCache desactivado: consultamos la API con timeout estricto 2.5s
  try {
    const fetched = options.fetcher
      ? await options.fetcher(year)
      : await fetchColombiaHolidays(year, { timeoutMs, baseUrl });

    if (Array.isArray(fetched) && fetched.length > 0) {
      const normalized = fetched.map(normalizeToNagerHoliday);
      // Escritura asíncrona en caché (Cache-Aside)
      await cache.saveHolidays(normalized, year).catch(() => {});
      return normalized;
    }
  } catch (error) {
    // API caída, lenta o con timeout: capturamos sin romper disponibilidad
    console.warn(
      `[nager-date] API Nager.Date falló o agotó timeout (${timeoutMs}ms) para el año ${year}. Recurriendo a fallback caché local:`,
      error instanceof Error ? error.message : error,
    );
  }

  // 3. Fallback a la tabla local FESTIVO
  const fallback = await cache.getByYear(year).catch(() => []);
  return fallback.map(normalizeToNagerHoliday);
}

/**
 * Alias semántico de getColombiaHolidays para el patrón Cache-Aside explícito.
 */
export const getColombiaHolidaysWithCache = getColombiaHolidays;

/**
 * Determina si una fecha específica en formato 'YYYY-MM-DD' corresponde a un festivo.
 * @param {string} dateISO - Fecha en formato 'YYYY-MM-DD'
 * @param {Array<NagerHoliday | { fecha: Date | string } | string>} holidays - Lista de festivos
 * @returns {boolean}
 */
export function isDateHoliday(
  dateISO: string,
  holidays: Array<NagerHoliday | { fecha: Date | string; nombre?: string } | string>,
): boolean {
  const target = dateISO.slice(0, 10);
  return holidays.some((h) => {
    if (typeof h === "string") return h.slice(0, 10) === target;
    if ("date" in h && typeof h.date === "string") return h.date.slice(0, 10) === target;
    if ("fecha" in h) {
      const s = h.fecha instanceof Date ? h.fecha.toISOString().slice(0, 10) : String(h.fecha).slice(0, 10);
      return s === target;
    }
    return false;
  });
}
