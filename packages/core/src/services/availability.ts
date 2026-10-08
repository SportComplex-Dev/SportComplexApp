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
