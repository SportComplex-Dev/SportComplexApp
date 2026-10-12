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

// =============================================================================
// TSK-BE-17: Validación de franja horaria de ingreso (HU-17 / RF-15 / RN-06)
// =============================================================================
const {
  ACCESS_WINDOW_EXPIRED_MESSAGE,
  ACCESS_SERVICE_MISMATCH_MESSAGE,
  ACCESS_ALREADY_USED_MESSAGE,
  decideAccess,
  hasServiceMismatch,
  isWithinAccessWindow,
  getTicketAccessWindow,
} = await import("./access-control");

// Franja 10:00–11:00 en Bogotá (UTC-5) => 15:00Z–16:00Z
const startBogota = new Date("2026-10-10T15:00:00.000Z"); // 10:00:00 Bogotá
const endBogota = new Date("2026-10-10T16:00:00.000Z");   // 11:00:00 Bogotá

test("TSK-BE-17 CRITERIO CLAVE: tiquete 10:00–11:00 con hora 10:15 se valida; a las 11:01 se deniega con mensaje contractual", () => {
  const at1015 = new Date("2026-10-10T15:15:00.000Z"); // 10:15:00 Bogotá
  const validResult = decideAccess({
    now: at1015,
    start: startBogota,
    end: endBogota,
    ticketStatus: "EMITIDO",
    ticketServiceId: "1",
    postServiceId: "1",
  });
  assert.deepEqual(validResult, { allowed: true, consume: true });

  const at1101 = new Date("2026-10-10T16:01:00.000Z"); // 11:01:00 Bogotá
  const expiredResult = decideAccess({
    now: at1101,
    start: startBogota,
    end: endBogota,
    ticketStatus: "EMITIDO",
    ticketServiceId: "1",
    postServiceId: "1",
  });
  assert.deepEqual(expiredResult, {
    allowed: false,
    code: "WINDOW_EXPIRED",
    message: ACCESS_WINDOW_EXPIRED_MESSAGE,
  });
  assert.equal(expiredResult.message, "Acceso denegado: Franja horaria vencida");
});

test("TSK-BE-17 RN-06: límites exactos [10:00:00, 11:00:00] se validan; 09:59:59 y 11:00:01 se deniegan", () => {
  // Límite inferior exacto 10:00:00
  assert.deepEqual(
    decideAccess({
      now: startBogota,
      start: startBogota,
      end: endBogota,
      ticketStatus: "EMITIDO",
      ticketServiceId: "1",
      postServiceId: "1",
    }),
    { allowed: true, consume: true },
  );

  // Límite superior exacto 11:00:00
  assert.deepEqual(
    decideAccess({
      now: endBogota,
      start: startBogota,
      end: endBogota,
      ticketStatus: "EMITIDO",
      ticketServiceId: "1",
      postServiceId: "1",
    }),
    { allowed: true, consume: true },
  );

  // Antes de la franja (09:59:59 Bogotá)
  const beforeStart = new Date("2026-10-10T14:59:59.000Z");
  assert.deepEqual(
    decideAccess({
      now: beforeStart,
      start: startBogota,
      end: endBogota,
      ticketStatus: "EMITIDO",
      ticketServiceId: "1",
      postServiceId: "1",
    }),
    {
      allowed: false,
      code: "WINDOW_EXPIRED",
      message: ACCESS_WINDOW_EXPIRED_MESSAGE,
    },
  );

  // Un segundo después de la franja (11:00:01 Bogotá)
  const afterEnd = new Date("2026-10-10T16:00:01.000Z");
  assert.deepEqual(
    decideAccess({
      now: afterEnd,
      start: startBogota,
      end: endBogota,
      ticketStatus: "EMITIDO",
      ticketServiceId: "1",
      postServiceId: "1",
    }),
    {
      allowed: false,
      code: "WINDOW_EXPIRED",
      message: ACCESS_WINDOW_EXPIRED_MESSAGE,
    },
  );
});

test("TSK-BE-17: isWithinAccessWindow valida el rango cerrado [start, end]", () => {
  assert.equal(isWithinAccessWindow(new Date("2026-10-10T15:15:00Z"), startBogota, endBogota), true);
  assert.equal(isWithinAccessWindow(startBogota, startBogota, endBogota), true);
  assert.equal(isWithinAccessWindow(endBogota, startBogota, endBogota), true);
  assert.equal(isWithinAccessWindow(new Date("2026-10-10T14:59:59Z"), startBogota, endBogota), false);
  assert.equal(isWithinAccessWindow(new Date("2026-10-10T16:00:01Z"), startBogota, endBogota), false);
});

test("TSK-BE-17: getTicketAccessWindow combina fecha y franja en zona horaria America/Bogota (-05:00)", () => {
  // Con objetos Date (como retorna Prisma)
  const windowFromDates = getTicketAccessWindow({
    fecha: new Date("2026-10-10T00:00:00.000Z"),
    franja: {
      horaInicio: new Date("1899-12-31T10:00:00.000Z"),
      horaFin: new Date("1899-12-31T11:00:00.000Z"),
    },
  });
  assert.equal(windowFromDates.start.toISOString(), "2026-10-10T15:00:00.000Z");
  assert.equal(windowFromDates.end.toISOString(), "2026-10-10T16:00:00.000Z");

  // Con strings de fecha y hora
  const windowFromStrings = getTicketAccessWindow({
    fecha: "2026-10-10",
    franja: {
      horaInicio: "10:00:00",
      horaFin: "11:00:00",
    },
  });
  assert.equal(windowFromStrings.start.toISOString(), "2026-10-10T15:00:00.000Z");
  assert.equal(windowFromStrings.end.toISOString(), "2026-10-10T16:00:00.000Z");
});

test("TSK-BE-17: decideAccess deniega servicio discrepante y boleto ya usado con mensajes claros", () => {
  const at1015 = new Date("2026-10-10T15:15:00.000Z");
  assert.deepEqual(
    decideAccess({
      now: at1015,
      start: startBogota,
      end: endBogota,
      ticketStatus: "EMITIDO",
      ticketServiceId: "1",
      postServiceId: "2",
    }),
    {
      allowed: false,
      code: "SERVICE_MISMATCH",
      message: ACCESS_SERVICE_MISMATCH_MESSAGE,
    },
  );

  assert.deepEqual(
    decideAccess({
      now: at1015,
      start: startBogota,
      end: endBogota,
      ticketStatus: "USADO",
      ticketServiceId: "1",
      postServiceId: "1",
    }),
    {
      allowed: false,
      code: "ALREADY_USED",
      message: ACCESS_ALREADY_USED_MESSAGE,
    },
  );
});

test("TSK-BE-16: la comparación compartida de servicios normaliza IDs y respeta el modo consulta", () => {
  assert.equal(hasServiceMismatch(1, 1), false);
  assert.equal(hasServiceMismatch("1", 1), false);
  assert.equal(hasServiceMismatch(1, "2"), true);
  assert.equal(hasServiceMismatch(1, null), false);
});

test("TSK-BE-17: robustez ante fechas inválidas, NaN o franjas invertidas", () => {
  const invalidDate = new Date("fecha-invalida");
  // isWithinAccessWindow devuelve false de forma segura
  assert.equal(isWithinAccessWindow(invalidDate, startBogota, endBogota), false);
  assert.equal(isWithinAccessWindow(startBogota, invalidDate, endBogota), false);
  assert.equal(isWithinAccessWindow(startBogota, startBogota, invalidDate), false);

  // Ventana invertida (start > end)
  assert.equal(isWithinAccessWindow(startBogota, endBogota, startBogota), false);

  // decideAccess deniega de forma segura con WINDOW_EXPIRED si now es inválido
  const deniedInvalid = decideAccess({
    now: invalidDate,
    start: startBogota,
    end: endBogota,
    ticketStatus: "EMITIDO",
    ticketServiceId: "1",
    postServiceId: "1",
  });
  assert.equal(deniedInvalid.allowed, false);
  assert.equal((deniedInvalid as { code: string }).code, "WINDOW_EXPIRED");

  // getTicketAccessWindow arroja RangeError ante fecha u hora inválidas
  assert.throws(
    () =>
      getTicketAccessWindow({
        fecha: invalidDate,
        franja: { horaInicio: "10:00:00", horaFin: "11:00:00" },
      }),
    RangeError,
  );
  assert.throws(
    () =>
      getTicketAccessWindow({
        fecha: "2026-10-10",
        franja: { horaInicio: invalidDate, horaFin: "11:00:00" },
      }),
    RangeError,
  );
  assert.throws(
    () =>
      getTicketAccessWindow({
        fecha: "2026-10-10",
        franja: { horaInicio: "hora-invalida", horaFin: "11:00:00" },
      }),
    RangeError,
  );
});
