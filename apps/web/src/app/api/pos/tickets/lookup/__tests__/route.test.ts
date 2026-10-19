/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const QR_SECRET = "secreto-qr-reimpresion";
const RESERVA_ID = "00000000-0000-4000-8000-0000000000aa";
const CODIGO = "9f0d6f4e-0000-4000-8000-0000000000ff";
const CLIENTE = "00000000-0000-4000-8000-000000000001";
const VENDEDOR = "00000000-0000-4000-8000-000000000002";

process.env.QR_HMAC_SECRET = QR_SECRET;
const { createMockPrisma } = await import("@db-test/mock-prisma");
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { GET } = await import("@/app/api/pos/tickets/lookup/route");
const { buildTicketQrPayload, signTicket } = await import("@sportcomplex/core");

for (const key of ["usuarios", "reservas", "tickets"] as const) mock._state[key].length = 0;
mock._state.usuarios.push(
  { id: CLIENTE, nombre: "Cliente", correo: "c@correo.test", estado: "ACTIVO", deletedAt: null, rolId: 3, rolNombre: "CLIENTE" },
  { id: VENDEDOR, nombre: "Vendedor", correo: "v@correo.test", estado: "ACTIVO", deletedAt: null, rolId: 2, rolNombre: "VENDEDOR" },
);
mock._state.reservas.push({ id: RESERVA_ID, disponibilidadId: 1n, estado: "CONFIRMADA", titularId: CLIENTE, cantidadCupos: 1 });
mock._state.tickets.push({ id: "ticket-1", reservaId: RESERVA_ID, codigoUuid: CODIGO, usadoPor: null, estado: "EMITIDO", usadoEn: null, emitidoEn: new Date() });

function buscar(codigo: string, userId = VENDEDOR) {
  (globalThis as any).__scAuthSession = { user: { id: userId } };
  return GET(new Request(`http://localhost/api/pos/tickets/lookup?codigo=${encodeURIComponent(codigo)}`));
}

test("Reimpresión: el QR firmado del pase resuelve la reserva", async () => {
  const res = await buscar(buildTicketQrPayload(CODIGO, signTicket(CODIGO, QR_SECRET)));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, { reservaId: RESERVA_ID });
});

test("Reimpresión: también acepta el UUID del boleto o de la reserva", async () => {
  assert.deepEqual((await (await buscar(CODIGO.toUpperCase())).json()).data, { reservaId: RESERVA_ID });
  assert.deepEqual((await (await buscar(RESERVA_ID)).json()).data, { reservaId: RESERVA_ID });
});

test("Reimpresión: un QR con firma falsa se rechaza", async () => {
  const res = await buscar(buildTicketQrPayload(CODIGO, "0".repeat(64)));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "INVALID_SIGNATURE");
});

test("Reimpresión: código desconocido → 404 y texto libre → 400", async () => {
  assert.equal((await buscar("11111111-1111-4111-8111-111111111111")).status, 404);
  assert.equal((await buscar("hola")).status, 400);
  assert.equal((await buscar("")).status, 400);
});

test("Reimpresión: el cliente no puede usar la búsqueda de taquilla", async () => {
  const res = await buscar(CODIGO, CLIENTE);
  assert.equal(res.status, 403);
});
