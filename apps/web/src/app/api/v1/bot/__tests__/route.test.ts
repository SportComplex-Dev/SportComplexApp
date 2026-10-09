import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.BOT_API_KEY = "bot-api-test-secret";
const qrSecret = "bot-qr-test-secret";
process.env.QR_HMAC_SECRET = qrSecret;

const mock = createMockPrisma();
Reflect.set(globalThis, "__scPrisma", mock);
const availabilityRoute = await import("../availability/route");
const { handleBotTicketValidation } = await import("../validate-ticket/route");
const { signTicket } = await import("@sportcomplex/core");

const ticketId = "9f0d6f4e-0000-4000-8000-000000000023";

function tomorrowInBogota(): string {
  const bogotaToday = new Date(Date.now() - 5 * 60 * 60 * 1000);
  bogotaToday.setUTCDate(bogotaToday.getUTCDate() + 1);
  return bogotaToday.toISOString().slice(0, 10);
}

function seedData() {
  for (const key of [
    "usuarios",
    "servicios",
    "franjas",
    "disponibilidades",
    "reservas",
    "tickets",
    "lecturas",
  ] as const) {
    mock._state[key].length = 0;
  }

  const date = tomorrowInBogota();
  mock._state.servicios.push({
    id: 1,
    categoriaId: 1,
    nombre: "Cancha 1",
    capacidadMaxima: 10,
    tarifa: 75000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  });
  mock._state.franjas.push({
    id: 1,
    servicioId: 1,
    diaSemana: 6,
    horaInicio: new Date("1899-12-31T10:00:00.000Z"),
    horaFin: new Date("1899-12-31T11:00:00.000Z"),
  });
  mock._state.disponibilidades.push({
    id: 1n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date(`${date}T00:00:00.000Z`),
    cuposTotales: 10,
    cuposOcupados: 3,
    bloqueadaMantenimiento: false,
  });
  mock._state.reservas.push({
    id: "expired-hold",
    disponibilidadId: 1n,
    estado: "PENDIENTE_PAGO",
    titularId: "00000000-0000-4000-8000-000000000001",
    cantidadCupos: 2,
    expiraEn: new Date(Date.now() - 60_000),
  });
  mock._state.reservas.push({
    id: "confirmed-booking",
    disponibilidadId: 1n,
    estado: "CONFIRMADA",
    titularId: "00000000-0000-4000-8000-000000000002",
    cantidadCupos: 1,
  });
  mock._state.tickets.push({
    id: "ticket-row-id",
    reservaId: "confirmed-booking",
    codigoUuid: ticketId,
    usadoPor: null,
    estado: "EMITIDO",
    usadoEn: null,
  });

  return date;
}

function apiRequest(url: string, apiKey = process.env.BOT_API_KEY) {
  const headers = new Headers();
  if (apiKey !== undefined) headers.set("x-api-key", apiKey);
  return new Request(url, { headers });
}

test("bot endpoints require a configured valid x-api-key", async () => {
  seedData();
  const before = structuredClone(mock._state);

  const missingKey = await availabilityRoute.GET(
    apiRequest("http://localhost/api/v1/bot/availability?serviceId=1&date=2026-10-10", ""),
  );
  const invalidKey = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signTicket(ticketId, qrSecret)}`,
      "wrong-key",
    ),
  );

  assert.equal(missingKey.status, 401);
  assert.equal(invalidKey.status, 401);
  assert.deepEqual(mock._state, before);
});

test("bot endpoints return 503 when required secrets are not configured", async () => {
  seedData();
  const savedBotKey = process.env.BOT_API_KEY;
  const savedQrSecret = process.env.QR_HMAC_SECRET;
  try {
    delete process.env.BOT_API_KEY;
    const keyUnavailable = await availabilityRoute.GET(
      apiRequest("http://localhost/api/v1/bot/availability?serviceId=1&date=2026-10-10"),
    );
    assert.equal(keyUnavailable.status, 503);
    const ticketKeyUnavailable = await handleBotTicketValidation(
      apiRequest(
        `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signTicket(ticketId, qrSecret)}`,
      ),
    );
    assert.equal(ticketKeyUnavailable.status, 503);

    process.env.BOT_API_KEY = savedBotKey;
    delete process.env.QR_HMAC_SECRET;
    const qrUnavailable = await handleBotTicketValidation(
      apiRequest(
        `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${"a".repeat(64)}`,
      ),
    );
    assert.equal(qrUnavailable.status, 503);
    assert.equal((await qrUnavailable.json()).error.code, "QR_NOT_CONFIGURED");
  } finally {
    if (savedBotKey === undefined) delete process.env.BOT_API_KEY;
    else process.env.BOT_API_KEY = savedBotKey;
    if (savedQrSecret === undefined) delete process.env.QR_HMAC_SECRET;
    else process.env.QR_HMAC_SECRET = savedQrSecret;
  }
});

test("bot availability accounts for expired holds without changing database rows", async () => {
  const date = seedData();
  const beforeReservations = structuredClone(mock._state.reservas);
  const beforeOccupancy = mock._state.disponibilidades[0].cuposOcupados;

  const response = await availabilityRoute.GET(
    apiRequest(
      `http://localhost/api/v1/bot/availability?serviceId=1&date=${date}`,
    ),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(typeof body.timestamp, "string");
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].cuposOcupados, 1);
  assert.equal(body.data[0].cuposDisponibles, 9);
  assert.equal(body.data[0].franja.horaInicio, "10:00:00");
  assert.equal(body.data[0].franja.horaFin, "11:00:00");
  assert.deepEqual(mock._state.reservas, beforeReservations);
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, beforeOccupancy);
});

test("bot ticket validation returns valid for an emitted ticket in its access window", async () => {
  const date = seedData();
  const beforeTicket = structuredClone(mock._state.tickets[0]);
  const beforeLecturas = structuredClone(mock._state.lecturas);
  const signature = signTicket(ticketId, qrSecret);

  const invalidSignature = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${"0".repeat(64)}`,
    ),
    new Date(`${date}T10:30:00-05:00`),
  );
  assert.equal(invalidSignature.status, 400);
  assert.deepEqual(mock._state.tickets[0], beforeTicket);
  assert.deepEqual(mock._state.lecturas, beforeLecturas);

  const response = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signature}`,
    ),
    new Date(`${date}T10:30:00-05:00`),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.estado, "EMITIDO");
  assert.equal(body.data.valido, true);
  assert.equal("motivo" in body.data, false);
  assert.deepEqual(mock._state.tickets[0], beforeTicket);
  assert.deepEqual(mock._state.lecturas, beforeLecturas);
});

test("bot ticket validation rejects cancelled reservations and inactive services", async () => {
  const date = seedData();
  const signature = signTicket(ticketId, qrSecret);
  const now = new Date(`${date}T10:30:00-05:00`);

  mock._state.reservas.find((reservation: { id: string }) => reservation.id === "confirmed-booking")!.estado =
    "CANCELADA_ADMINISTRATIVA";
  let response = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signature}`,
    ),
    now,
  );
  let body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.valido, false);
  assert.equal(body.data.motivo, "RESERVATION_CANCELLED");

  mock._state.reservas.find((reservation: { id: string }) => reservation.id === "confirmed-booking")!.estado =
    "CONFIRMADA";
  mock._state.servicios[0].estado = "INHABILITADO";
  response = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signature}`,
    ),
    now,
  );
  body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.valido, false);
  assert.equal(body.data.motivo, "SERVICE_INACTIVE");
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas.length, 0);
});

test("bot ticket validation reports used tickets without rewriting them", async () => {
  const date = seedData();
  mock._state.tickets[0].estado = "USADO";
  mock._state.tickets[0].usadoPor = "lector-1";
  mock._state.tickets[0].usadoEn = new Date("2026-10-09T10:00:00.000Z");
  const beforeTicket = structuredClone(mock._state.tickets[0]);
  const signature = signTicket(ticketId, qrSecret);

  const response = await handleBotTicketValidation(
    apiRequest(
      `http://localhost/api/v1/bot/validate-ticket?ticketId=${ticketId}&signature=${signature}`,
    ),
    new Date(`${date}T10:30:00-05:00`),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.valido, false);
  assert.equal(body.data.motivo, "ALREADY_USED");
  assert.deepEqual(mock._state.tickets[0], beforeTicket);
});
