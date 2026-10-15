import { fetchColombiaHolidays, type NagerHoliday, STRICT_TIMEOUT_MS } from "./cliente.js";

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
export function normalizeToNagerHoliday(
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
 * Implementación de almacén en memoria para cuando no se provee persistencia relacional directa.
 */
export class MemoryHolidayCacheStore implements HolidayCacheStore {
  private cache = new Map<number, NagerHoliday[]>();

  async getByYear(year: number): Promise<NagerHoliday[]> {
    return this.cache.get(year) ?? [];
  }

  async saveHolidays(holidays: NagerHoliday[], year: number): Promise<void> {
    this.cache.set(year, holidays);
  }
}

export const defaultHolidayCacheStore: HolidayCacheStore = new MemoryHolidayCacheStore();

export interface GetColombiaHolidaysOptions {
  cacheStore?: HolidayCacheStore;
  fetcher?: (year: number) => Promise<NagerHoliday[]>;
  timeoutMs?: number;
  baseUrl?: string;
  preferCache?: boolean;
  forceRefresh?: boolean;
}

/**
 * Motor de obtención de festivos con patrón Cache-Aside y timeout estricto de 2.5s.
 */
export async function getColombiaHolidays(
  year: number,
  options: GetColombiaHolidaysOptions = {},
): Promise<NagerHoliday[]> {
  const cache = options.cacheStore ?? defaultHolidayCacheStore;
  const timeoutMs = options.timeoutMs ?? STRICT_TIMEOUT_MS;
  const baseUrl = options.baseUrl;
  const forceRefresh = options.forceRefresh ?? false;
  const preferCache = options.preferCache ?? true;

  if (preferCache && !forceRefresh) {
    const cached = await cache.getByYear(year).catch(() => []);
    if (cached && cached.length > 0) {
      return cached.map(normalizeToNagerHoliday);
    }
  }

  try {
    const fetched = options.fetcher
      ? await options.fetcher(year)
      : await fetchColombiaHolidays(year, { timeoutMs, baseUrl });

    if (Array.isArray(fetched) && fetched.length > 0) {
      const normalized = fetched.map(normalizeToNagerHoliday);
      await cache.saveHolidays(normalized, year).catch(() => {});
      return normalized;
    }
  } catch (error) {
    console.warn(
      `[nager-date] API Nager.Date falló o agotó timeout (${timeoutMs}ms) para el año ${year}. Recurriendo a fallback caché:`,
      error instanceof Error ? error.message : error,
    );
  }

  const fallback = await cache.getByYear(year).catch(() => []);
  return fallback.map(normalizeToNagerHoliday);
}

/**
 * Alias semántico de getColombiaHolidays para el patrón Cache-Aside explícito.
 */
export const getColombiaHolidaysWithCache = getColombiaHolidays;

/**
 * Determina si una fecha específica en formato 'YYYY-MM-DD' corresponde a un festivo.
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
