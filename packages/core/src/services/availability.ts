import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { BOOKING_WINDOW_DAYS, CHECKOUT_TTL_MINUTES, TIMEZONE } from "../domain/index";

/**
 * TSK-BE-06 — RN-01 ventana máxima 15 días + RN-11 prohibición de pasado.
 * Todo calculado en fecha calendario legal `America/Bogota` (date-fns-tz).
 */

/** Mensaje contractual exigido por el criterio de aceptación (HTTP 400). */
export const BOOKING_WINDOW_EXCEEDED_MESSAGE =
  "La reserva excede la ventana máxima permitida de 15 días" as const;

/** Mensaje para RN-11 (fechas/hora u hora ya pasadas). */
export const BOOKING_IN_PAST_MESSAGE =
  "La reserva no puede agendarse en una fecha u hora pasada." as const;

export class BookingWindowError extends Error {
  constructor(message: string = BOOKING_WINDOW_EXCEEDED_MESSAGE) {
    super(message);
    this.name = "BookingWindowError";
  }
}

/** Fecha calendario `YYYY-MM-DD` de un instante en `America/Bogota`. */
export function bogotaDateString(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}

/** Último día reservable (Bogota): hoy + `BOOKING_WINDOW_DAYS` días calendario. */
export function maxBookingDateString(now: Date = new Date()): string {
  const today = bogotaDateString(now);
  return bogotaDateString(addDays(new Date(`${today}T12:00:00-05:00`), BOOKING_WINDOW_DAYS));
}
export function isWithinBookingWindow(now: Date, start: Date): boolean {
  if (start.getTime() <= now.getTime()) return false; // RN-11
  return bogotaDateString(start) <= maxBookingDateString(now); // RN-01
}

/**
 * Valida RN-01 + RN-11 sobre el instante de inicio de la reserva.
 * @throws BookingWindowError si `start` ya pasó (RN-11) o supera `T + 15 días` (RN-01).
 */
export function validateBookingWindow(start: Date, now: Date = new Date()): void {
  if (start.getTime() <= now.getTime()) {
    throw new BookingWindowError(BOOKING_IN_PAST_MESSAGE);
  }
  if (bogotaDateString(start) > maxBookingDateString(now)) {
    throw new BookingWindowError(); // mensaje contractual RN-01
  }
}

export function checkoutExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + CHECKOUT_TTL_MINUTES * 60 * 1000); // RN-04 TTL 30 min
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

