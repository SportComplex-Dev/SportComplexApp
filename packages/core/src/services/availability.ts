import { BOOKING_WINDOW_DAYS, CHECKOUT_TTL_MINUTES } from "../domain/index";

// RN-01 ventana 15 días + RN-11 prohibición de pasado. Todo en America/Bogota.
export function isWithinBookingWindow(now: Date, start: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  if (start.getTime() <= now.getTime()) return false; // RN-11
  const diffDays = (start.getTime() - now.getTime()) / msPerDay;
  return diffDays <= BOOKING_WINDOW_DAYS; // RN-01
}

export function checkoutExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + CHECKOUT_TTL_MINUTES * 60 * 1000); // RN-04 TTL 30 min
}
