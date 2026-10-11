import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_IN_PAST_MESSAGE,
  BOOKING_WINDOW_EXCEEDED_MESSAGE,
  BookingWindowError,
  bogotaDateString,
  isWithinBookingWindow,
  validateBookingWindow,
} from "./availability";

// Referencia fija: 2026-10-08 12:00 UTC == 2026-10-08 07:00 America/Bogota.
const NOW = new Date("2026-10-08T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

test("TSK-BE-06: T + 15 días calendario (Bogota) está dentro de la ventana", () => {
  const start = new Date("2026-10-23T20:00:00-05:00"); // 23/Oct 20:00 Bogota
  assert.equal(bogotaDateString(start), "2026-10-23");
  assert.equal(isWithinBookingWindow(NOW, start), true);
  assert.doesNotThrow(() => validateBookingWindow(start, NOW));
});

test("TSK-BE-06: T + 16 días lanza BookingWindowError con el mensaje contractual", () => {
  const start = new Date("2026-10-24T06:00:00-05:00"); // 24/Oct 06:00 Bogota
  assert.equal(bogotaDateString(start), "2026-10-24");
  assert.equal(isWithinBookingWindow(NOW, start), false);
  assert.throws(
    () => validateBookingWindow(start, NOW),
    (err: unknown) =>
      err instanceof BookingWindowError && err.message === BOOKING_WINDOW_EXCEEDED_MESSAGE,
  );
});

test("TSK-BE-06: RN-11 — fechas pasadas son rechazadas", () => {
  const past = new Date(NOW.getTime() - DAY_MS);
  assert.equal(isWithinBookingWindow(NOW, past), false);
  assert.throws(
    () => validateBookingWindow(past, NOW),
    (err: unknown) =>
      err instanceof BookingWindowError && err.message === BOOKING_IN_PAST_MESSAGE,
  );
});

test("TSK-BE-06: el borde de la ventana se calcula en Bogota, no en UTC", () => {
  // 2026-10-09 01:00 UTC == 2026-10-08 20:00 Bogota: todavía es "hoy" legal.
  const nowLateUtc = new Date("2026-10-09T01:00:00.000Z");
  const start = new Date("2026-10-23T23:00:00-05:00"); // último minuto del día máximo.
  assert.equal(isWithinBookingWindow(nowLateUtc, start), true);
  assert.equal(bogotaDateString(nowLateUtc), "2026-10-08");
});
