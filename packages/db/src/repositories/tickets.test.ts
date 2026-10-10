/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { ejecutarLectura, TicketError } from "./tickets.js";
import { createMockPrisma } from "../../test/mock-prisma";

function seedTicket(mock: any) {
  mock._state.usuarios.push(
    { id: "lector-1", nombre: "Lectora X" },
    { id: "user-1", nombre: "Cliente Uno" },
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
    titularId: "user-1",
    cantidadCupos: 1,
  });
  mock._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: "9f0d6f4e-0000-4000-8000-000000000001",
    usadoPor: null,
    estado: "EMITIDO",
    usadoEn: null,
  });
}

const BASE = {
  ticketId: "ticket-1",
  modo: "TURNO" as const,
  resultado: "CONCEDIDO" as const,
  consumir: true,
  empleadoId: "lector-1",
  asignacionId: 7,
  now: new Date("2026-10-10T15:30:00.000Z"),
};

test("TSK-BD-10: canje TURNO transmuta EMITIDO→USADO y audita CONCEDIDO", async () => {
  const mock = createMockPrisma();
  seedTicket(mock);

  const res = await ejecutarLectura({ ...BASE, db: mock });
  assert.equal(res.canjeado, true);
  assert.equal(res.resultado, "CONCEDIDO");
  assert.equal(res.ticketEstado, "USADO");

  const ticket = mock._state.tickets[0];
  assert.equal(ticket.estado, "USADO");
  assert.equal(ticket.usadoPor, "lector-1");
  assert.equal(ticket.usadoEn, BASE.now);

  assert.equal(mock._state.lecturas.length, 1);
  const lectura = mock._state.lecturas[0];
  assert.equal(lectura.modo, "TURNO");
  assert.equal(lectura.resultado, "CONCEDIDO");
  assert.equal(lectura.asignacionId, 7);
  assert.equal(lectura.empleadoId, "lector-1");
});

test("TSK-BD-10 (CRITERIO): un boleto USADO nunca vuelve a EMITIDO — doble canje deja 1 USADO y 2 auditorías", async () => {
  const mock = createMockPrisma();
  seedTicket(mock);

  const primera = await ejecutarLectura({ ...BASE, db: mock });
  assert.equal(primera.canjeado, true);

  const segunda = await ejecutarLectura({ ...BASE, db: mock });
  assert.equal(segunda.canjeado, false);
  assert.equal(segunda.resultado, "DENEGADO_USADO");
  assert.equal(segunda.ticketEstado, "USADO");

  assert.equal(mock._state.tickets[0].estado, "USADO");
  assert.equal(mock._state.tickets[0].usadoEn, BASE.now);
  assert.equal(mock._state.lecturas.length, 2);
  assert.deepEqual(
    mock._state.lecturas.map((l: any) => l.resultado),
    ["CONCEDIDO", "DENEGADO_USADO"],
  );
});

test("TSK-BD-10 (CRITERIO): modo CONSULTA audita CONSULTA con asignacion_id nulo SIN alterar el boleto", async () => {
  const mock = createMockPrisma();
  seedTicket(mock);

  const res = await ejecutarLectura({
    ...BASE,
    modo: "CONSULTA",
    resultado: "CONSULTA",
    consumir: false,
    asignacionId: null,
    db: mock,
  });
  assert.equal(res.canjeado, false);
  assert.equal(res.resultado, "CONSULTA");
  assert.equal(res.ticketEstado, "EMITIDO"); // intacto

  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.tickets[0].usadoPor, null);
  assert.equal(mock._state.tickets[0].usadoEn, null);

  assert.equal(mock._state.lecturas.length, 1);
  const lectura = mock._state.lecturas[0];
  assert.equal(lectura.modo, "CONSULTA");
  assert.equal(lectura.resultado, "CONSULTA");
  assert.equal(lectura.asignacionId, null);
});

test("TSK-BD-10: denegación TURNO audita sin consumir el boleto", async () => {
  const mock = createMockPrisma();
  seedTicket(mock);

  const res = await ejecutarLectura({
    ...BASE,
    resultado: "DENEGADO_SERVICIO",
    consumir: false,
    db: mock,
  });
  assert.equal(res.canjeado, false);
  assert.equal(res.resultado, "DENEGADO_SERVICIO");
  assert.equal(res.ticketEstado, "EMITIDO");
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_SERVICIO");
});

test("TSK-BD-10: CONSULTA rechaza asignacion_id no nulo (VALIDATION_ERROR 400)", async () => {
  const mock = createMockPrisma();
  seedTicket(mock);

  await assert.rejects(
    () =>
      ejecutarLectura({
        ...BASE,
        modo: "CONSULTA",
        resultado: "CONSULTA",
        consumir: false,
        asignacionId: 3,
        db: mock,
      }),
    (err: unknown) =>
      err instanceof TicketError && err.code === "VALIDATION_ERROR" && err.status === 400,
  );
  assert.equal(mock._state.lecturas.length, 0);
});
