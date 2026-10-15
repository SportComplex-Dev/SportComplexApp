import type { BookingHistoryCursor } from "./tipos";
import {
  BookingError,
  BOOKING_WINDOW_DAYS,
  BOGOTA_TIME_ZONE,
  BOOKING_WINDOW_EXCEEDED_MESSAGE,
} from "./errores";

export function encodeHistoryCursor(booking: { creadoEn: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: booking.creadoEn.toISOString(), id: booking.id }),
  ).toString("base64url");
}

export function decodeHistoryCursor(cursor: string): BookingHistoryCursor {
  try {
    if (cursor.length > 512) throw new Error("Cursor is too large");
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Cursor shape is invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(parsed.id)) {
      throw new Error("Cursor values are invalid");
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new BookingError("El cursor de historial no es válido.", "INVALID_CURSOR", 400);
  }
}

export function dateInBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function secondsFromDbTime(value: Date): number {
  return value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds();
}

export function secondsFromInstant(value: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOGOTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function validateBookingDate(date: string, now: Date): void {
  const today = dateInBogota(now);
  const daysAhead = daysBetween(today, date);
  if (daysAhead < 0 || daysAhead > BOOKING_WINDOW_DAYS) {
    throw new BookingError(BOOKING_WINDOW_EXCEEDED_MESSAGE, "OUTSIDE_BOOKING_WINDOW", 400);
  }
}

export function slotMatchesRequest(
  availability: {
    fecha: Date;
    franja: { horaInicio: Date; horaFin: Date };
  },
  startTime: Date,
  endTime: Date,
): boolean {
  return (
    startTime.getUTCMilliseconds() === 0 &&
    endTime.getUTCMilliseconds() === 0 &&
    dateFromDb(availability.fecha) === dateInBogota(startTime) &&
    secondsFromDbTime(availability.franja.horaInicio) === secondsFromInstant(startTime) &&
    secondsFromDbTime(availability.franja.horaFin) === secondsFromInstant(endTime)
  );
}
