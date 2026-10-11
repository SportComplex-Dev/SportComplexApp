import test from "node:test";
import assert from "node:assert/strict";
import { validateBotTicket } from "./access-control";

const base = {
  now: new Date("2026-10-10T15:30:00.000Z"),
  start: new Date("2026-10-10T15:00:00.000Z"),
  end: new Date("2026-10-10T16:00:00.000Z"),
  ticketStatus: "EMITIDO" as const,
  reservationStatus: "CONFIRMADA",
  serviceStatus: "ACTIVO",
};

test("bot ticket validation allows only confirmed reservations for active services within their window", () => {
  assert.deepEqual(validateBotTicket(base), { valid: true });
});

test("bot ticket validation reports cancelled and pending reservations", () => {
  assert.deepEqual(
    validateBotTicket({ ...base, reservationStatus: "CANCELADA_ADMINISTRATIVA" }),
    { valid: false, reason: "RESERVATION_CANCELLED" },
  );
  assert.deepEqual(
    validateBotTicket({ ...base, reservationStatus: "PENDIENTE_PAGO" }),
    { valid: false, reason: "RESERVATION_NOT_CONFIRMED" },
  );
});

test("bot ticket validation reports inactive services, used tickets, and invalid windows", () => {
  assert.deepEqual(
    validateBotTicket({ ...base, serviceStatus: "INHABILITADO" }),
    { valid: false, reason: "SERVICE_INACTIVE" },
  );
  assert.deepEqual(
    validateBotTicket({ ...base, ticketStatus: "USADO" }),
    { valid: false, reason: "ALREADY_USED" },
  );
  assert.deepEqual(
    validateBotTicket({ ...base, now: new Date("2026-10-10T16:00:01.000Z") }),
    { valid: false, reason: "WINDOW_EXPIRED" },
  );
});
