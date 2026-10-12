import { TIMEZONE } from "../domain/index";
import { getColombiaHolidays, type GetColombiaHolidaysOptions } from "../integrations/nager-date";

export type MaintenanceReason =
  | "MANTENIMIENTO_LUNES"
  | "MANTENIMIENTO_TRASLADADO_MARTES";

export interface PoolMaintenanceResult {
  blocked: boolean;
  reason?: MaintenanceReason;
}

export type HolidayInput =
  | string // "YYYY-MM-DD" o formato ISO
  | Date
  | { date: string }
  | { fecha: Date | string };

/**
 * Extrae y normaliza los componentes de la fecha en la zona horaria legal de Colombia (America/Bogota, UTC-5).
 * @param {Date | string} input - Fecha como Date o cadena
 * @returns {{ dateISO: string, dayOfWeek: number, prevDayDateISO: string, year: number }}
 */
export function getBogotaDateParts(input: Date | string): {
  dateISO: string;
  dayOfWeek: number;
  prevDayDateISO: string;
  year: number;
} {
  const d =
    typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())
      ? new Date(`${input.trim()}T12:00:00-05:00`)
      : new Date(input);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  });

  const dateISO = formatter.format(d);
  const weekdayStr = weekdayFormatter.format(d);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[weekdayStr] ?? 0;

  const prevDate = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const prevDayDateISO = formatter.format(prevDate);
  const year = Number.parseInt(dateISO.slice(0, 4), 10);

  return { dateISO, dayOfWeek, prevDayDateISO, year };
}

function extractDateString(val: Date | string): string {
  if (typeof val === "string") {
    return val.slice(0, 10);
  }
  // En Prisma (@db.Date), las fechas se instancian a medianoche UTC (00:00:00.000Z)
  if (val.getUTCHours() === 0 && val.getUTCMinutes() === 0 && val.getUTCSeconds() === 0) {
    return val.toISOString().slice(0, 10);
  }
  // Para fechas con hora específica, obtenemos el día en America/Bogota
  return getBogotaDateParts(val).dateISO;
}

/**
 * Normaliza una colección heterogénea de festivos a un Set de cadenas 'YYYY-MM-DD'.
 * @param {HolidayInput[] | Set<string> | Iterable<HolidayInput>} holidays - Colección de festivos
 * @returns {Set<string>}
 */
export function normalizeHolidaysToSet(
  holidays: HolidayInput[] | Set<string> | Iterable<HolidayInput>,
): Set<string> {
  const set = new Set<string>();
  for (const h of holidays) {
    if (typeof h === "string") {
      set.add(h.slice(0, 10));
    } else if (h instanceof Date) {
      set.add(extractDateString(h));
    } else if (typeof h === "object" && h !== null) {
      if ("date" in h && typeof h.date === "string") {
        set.add(h.date.slice(0, 10));
      } else if ("fecha" in h) {
        set.add(extractDateString(h.fecha));
      }
    }
  }
  return set;
}

/**
 * Función pura de negocio: RN-02 / RF-06 / HU-07
 * Determina si una fecha corresponde a cierre por mantenimiento de piscinas.
 *
 * Criterios de aceptación (Jira SCRUM-103 / TSK-BE-07):
 * (a) Lunes ordinario: bloquea todas las franjas (reason: MANTENIMIENTO_LUNES).
 * (b) Lunes festivo: abre el lunes y traslada el mantenimiento al martes posterior (reason: MANTENIMIENTO_TRASLADADO_MARTES).
 * (c) Cualquier otro día (o martes tras lunes ordinario): abierto sin bloqueo.
 *
 * @param {Date | string} date - Fecha a evaluar en zona horaria America/Bogota
 * @param {HolidayInput[] | Set<string> | Iterable<HolidayInput> | boolean} [holidays] - Lista de festivos o booleano de soporte legado
 * @returns {PoolMaintenanceResult} Objeto con propiedad `blocked` y opcionalmente `reason`
 */
export function isPoolMaintenanceDay(
  date: Date | string,
  holidays?: HolidayInput[] | Set<string> | Iterable<HolidayInput> | boolean,
): PoolMaintenanceResult {
  const { dateISO, dayOfWeek, prevDayDateISO } = getBogotaDateParts(date);

  // Soporte de compatibilidad hacia atrás: si se pasa booleano directamente
  if (typeof holidays === "boolean") {
    if (dayOfWeek === 1 && !holidays) {
      return { blocked: true, reason: "MANTENIMIENTO_LUNES" };
    }
    if (dayOfWeek === 2 && holidays) {
      return { blocked: true, reason: "MANTENIMIENTO_TRASLADADO_MARTES" };
    }
    return { blocked: false };
  }

  const holidaySet = holidays ? normalizeHolidaysToSet(holidays) : new Set<string>();

  // Lunes: día 1
  if (dayOfWeek === 1) {
    const isHoliday = holidaySet.has(dateISO);
    if (!isHoliday) {
      // Lunes ordinario: cerrado por mantenimiento
      return { blocked: true, reason: "MANTENIMIENTO_LUNES" };
    }
    // Lunes festivo: la piscina opera al público
    return { blocked: false };
  }

  // Martes: día 2
  if (dayOfWeek === 2) {
    const wasMondayHoliday = holidaySet.has(prevDayDateISO);
    if (wasMondayHoliday) {
      // Mantenimiento trasladado al martes
      return { blocked: true, reason: "MANTENIMIENTO_TRASLADADO_MARTES" };
    }
    return { blocked: false };
  }

  // Miércoles (3), Jueves (4), Viernes (5), Sábado (6), Domingo (0)
  return { blocked: false };
}

/**
 * Función orquestadora de alto nivel para verificar disponibilidad de piscina frente a mantenimiento.
 * Consulta festivos mediante el cliente Nager.Date con timeout 2.5s y patrón Cache-Aside a la tabla FESTIVO.
 * En caso de caída de la API, no rompe disponibilidad y responde desde la caché.
 *
 * @param {Date | string} date - Fecha a consultar
 * @param {GetColombiaHolidaysOptions} [options] - Opciones de consulta y caché
 * @returns {Promise<PoolMaintenanceResult>}
 */
export async function checkPoolMaintenanceWithCache(
  date: Date | string,
  options?: GetColombiaHolidaysOptions,
): Promise<PoolMaintenanceResult> {
  const { year } = getBogotaDateParts(date);
  const holidays = await getColombiaHolidays(year, options);
  return isPoolMaintenanceDay(date, holidays);
}
