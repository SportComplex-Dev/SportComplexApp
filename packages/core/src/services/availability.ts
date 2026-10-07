import { BOOKING_WINDOW_DAYS } from "../domain/index";

// RN-01 ventana 15 días + RN-11 prohibición de pasado. Todo en America/Bogota.
export function isWithinBookingWindow(now: Date, start: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  if (start.getTime() <= now.getTime()) return false; // RN-11
  const diffDays = (start.getTime() - now.getTime()) / msPerDay;
  return diffDays <= BOOKING_WINDOW_DAYS; // RN-01
}

export function checkoutExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + 15 * 60 * 1000); // RN-04 TTL 15 min
}

/** Configuración de horario y aforo para un servicio específico (RF-04 / HU-05) */
export interface OperatingScheduleConfig {
  serviceId: string;
  serviceName: string;
  categorySlug: string;
  capacity: number; // Aforo máximo (> 0, CHECK capacity > 0)
  isShared: boolean; // true para servicios compartidos con cupos por persona (ej. gimnasio, piscina), false para exclusivo (canchas)
  startHour: number; // Hora inicio en formato 24h (por defecto 6 -> 06:00)
  endHour: number; // Hora fin en formato 24h (por defecto 22 -> 22:00)
  slotDurationMinutes: number; // Duración fija de 60 minutos
  disabledSlots: string[]; // Ranuras deshabilitadas/mantenimiento (ej. ['13:00'])
}

/** Representación de una ranura horaria operativa generada */
export interface GeneratedOperatingSlot {
  time: string; // ej. "06:00"
  endTime: string; // ej. "07:00"
  label: string; // ej. "06:00 – 07:00"
  startHour: number;
  endHour: number;
  capacity: number;
  isShared: boolean;
  isAvailable: boolean;
  disabledReason?: string;
}

/**
 * Generador puro de ranuras horarias operativas entre 06:00 y 22:00 (RF-04).
 * Genera turnos continuos de 60 minutos.
 */
export function generateOperatingSlots(
  config: OperatingScheduleConfig
): GeneratedOperatingSlot[] {
  const slots: GeneratedOperatingSlot[] = [];
  const start = Math.max(0, Math.min(23, config.startHour));
  const end = Math.max(start + 1, Math.min(24, config.endHour));

  for (let hour = start; hour < end; hour++) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeStr = `${pad(hour)}:00`;
    const nextHourStr = `${pad(hour + 1)}:00`;
    const isDisabled = config.disabledSlots?.includes(timeStr) ?? false;

    slots.push({
      time: timeStr,
      endTime: nextHourStr,
      label: `${timeStr} – ${nextHourStr}`,
      startHour: hour,
      endHour: hour + 1,
      capacity: config.capacity,
      isShared: config.isShared,
      isAvailable: !isDisabled,
      disabledReason: isDisabled ? "Mantenimiento / Pausada por administración" : undefined,
    });
  }

  return slots;
}

/**
 * Validador de capacidad/aforo conforme a la restricción CHECK capacity > 0
 */
export function validateServiceCapacity(capacity: number): {
  valid: boolean;
  error?: string;
} {
  if (typeof capacity !== "number" || isNaN(capacity)) {
    return { valid: false, error: "La capacidad debe ser un número entero." };
  }
  if (!Number.isInteger(capacity)) {
    return { valid: false, error: "La capacidad debe ser un número entero." };
  }
  if (capacity <= 0) {
    return { valid: false, error: "La capacidad debe ser estrictamente mayor a 0 (CHECK capacity > 0)." };
  }
  return { valid: true };
}

/** Representación de un día del calendario con validación de ventana de 15 días (TSK-FE-06 / RN-01) */
export interface BookingCalendarDay {
  dateISO: string;
  dayNumber: number;
  weekdayShort: string;
  weekdayFull: string;
  monthShort: string;
  monthFull: string;
  year: number;
  isToday: boolean;
  isPast: boolean;
  isWithinWindow: boolean;
  isBeyondWindow: boolean;
  daysAhead: number;
}

/**
 * Obtiene la fecha actual en formato YYYY-MM-DD calculada en la zona horaria del complejo (America/Bogota) (RNF-02).
 */
export function getBogotaTodayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Genera la secuencia de días para el selector de fechas con restricción de ventana de 15 días (TSK-FE-06 / RF-05).
 * Los días donde daysAhead > 15 quedan marcados con isBeyondWindow = true (deshabilitados y no clickeables).
 */
export function getBookingCalendarDays(
  windowDays: number = BOOKING_WINDOW_DAYS,
  totalDaysToShow: number = 20,
  now: Date = new Date()
): BookingCalendarDay[] {
  const todayISO = getBogotaTodayISO(now);
  const [yearStr, monthStr, dayStr] = todayISO.split("-");
  const baseDate = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr), 12, 0, 0));

  const days: BookingCalendarDay[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");

  const weekdayFormatterShort = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short" });
  const weekdayFormatterFull = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "long" });
  const monthFormatterShort = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", month: "short" });
  const monthFormatterFull = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", month: "long" });

  for (let offset = 0; offset < totalDaysToShow; offset++) {
    const cur = new Date(baseDate.getTime() + offset * 86_400_000);
    const y = cur.getUTCFullYear();
    const m = cur.getUTCMonth();
    const d = cur.getUTCDate();
    const dateISO = `${y}-${pad(m + 1)}-${pad(d)}`;

    const isToday = offset === 0;
    const isPast = offset < 0;
    const isWithinWindow = offset >= 0 && offset <= windowDays;
    const isBeyondWindow = offset > windowDays;

    days.push({
      dateISO,
      dayNumber: d,
      weekdayShort: weekdayFormatterShort.format(cur).replace(".", ""),
      weekdayFull: weekdayFormatterFull.format(cur),
      monthShort: monthFormatterShort.format(cur).replace(".", ""),
      monthFull: monthFormatterFull.format(cur),
      year: y,
      isToday,
      isPast,
      isWithinWindow,
      isBeyondWindow,
      daysAhead: offset,
    });
  }

  return days;
}

