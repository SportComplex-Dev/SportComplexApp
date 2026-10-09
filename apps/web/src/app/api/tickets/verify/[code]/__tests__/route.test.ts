/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const SECRET = "test-ticket-verification-secret";
const CODIGO = "9f0d6f4e-0000-4000-8000-0000000000ff";
const LECTOR = "lector-1";

process.env.QR_HMAC_SECRET = SECRET;

const { createMockPrisma } = await import(
  "../../../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { handleTicketVerification } = await import("../route");
const { signTicket } = await import("@sportcomplex/core");

function seedTicket() {
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

  mock._state.usuarios.push(
    {
      id: LECTOR,
      nombre: "Lector",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "LECTOR",
    },
    {
      id: "usuario-1",
      nombre: "Cliente",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 3,
      rolNombre: "CLIENTE",
    },
  );
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
    fecha: new Date("2026-10-10T00:00:00.000Z"),
    cuposTotales: 10,
    cuposOcupados: 1,
    bloqueadaMantenimiento: false,
  });
  mock._state.reservas.push({
    id: "reserva-1",
    disponibilidadId: 1n,
    estado: "CONFIRMADA",
    titularId: "usuario-1",
    cantidadCupos: 1,
  });
  mock._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: CODIGO,
    usadoPor: null,
    estado: "EMITIDO",
    usadoEn: null,
  });
}

function request(signature?: string) {
  const headers = new Headers();
  if (signature !== undefined) headers.set("x-ticket-signature", signature);
  return new Request(`http://localhost:3000/api/tickets/verify/${CODIGO}`, { headers });
}

const context = { params: Promise.resolve({ code: CODIGO }) };
const authenticatedAs = (id: string, role: string) => async () => ({
  user: { id, role },
});

test("TSK-BE-15: consulta válida audita CONSULTA y conserva idéntico el estado del boleto", async () => {
  seedTicket();
  const ticketBefore = { ...mock._state.tickets[0] };

  const response = await handleTicketVerification(
    request(signTicket(CODIGO, SECRET)),
    context,
    authenticatedAs(LECTOR, "EMPLEADO_LECTOR"),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.modo, "CONSULTA");
  assert.equal(body.data.resultado, "CONSULTA");
  assert.equal(body.data.canjeado, false);
  assert.equal(body.data.ticket.estado, ticketBefore.estado);
  assert.deepEqual(mock._state.tickets[0], ticketBefore);
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].modo, "CONSULTA");
  assert.equal(mock._state.lecturas[0].resultado, "CONSULTA");
  assert.equal(mock._state.lecturas[0].asignacionId, null);
});

test("TSK-BE-15: firma ausente o inválida se rechaza sin consultar ni escribir en la DB", async () => {
  seedTicket();
  const ticketBefore = { ...mock._state.tickets[0] };
  const authenticate = authenticatedAs(LECTOR, "ADMINISTRADOR");

  const missing = await handleTicketVerification(request(), context, authenticate);
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, "MISSING_SIGNATURE");

  const invalid = await handleTicketVerification(
    request("0".repeat(64)),
    context,
    authenticate,
  );
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "INVALID_SIGNATURE");
  assert.deepEqual(mock._state.tickets[0], ticketBefore);
  assert.equal(mock._state.lecturas.length, 0);
});

test("TSK-BE-15: rechaza usuario no autenticado y rol sin permiso antes de acceder a la DB", async () => {
  seedTicket();

  const unauthenticated = await handleTicketVerification(
    request(signTicket(CODIGO, SECRET)),
    context,
    async () => null,
  );
  assert.equal(unauthenticated.status, 401);

  const forbidden = await handleTicketVerification(
    request(signTicket(CODIGO, SECRET)),
    context,
    authenticatedAs("cliente-1", "CLIENTE"),
  );
  assert.equal(forbidden.status, 403);
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});

test("TSK-BE-21: empleado inactivo no puede consultar tickets", async () => {
  seedTicket();
  mock._state.usuarios.find((user: { id: string }) => user.id === LECTOR)!.estado = "INACTIVO";

  const response = await handleTicketVerification(
    request(signTicket(CODIGO, SECRET)),
    context,
    authenticatedAs(LECTOR, "EMPLEADO_LECTOR"),
  );

  assert.equal(response.status, 403);
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});
