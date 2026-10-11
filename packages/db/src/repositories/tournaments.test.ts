/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TournamentError,
  crearTorneo,
  listarTorneos,
  obtenerTorneoPorId,
  actualizarEstadoTorneo,
  inscribirUsuarioTorneo,
  obtenerInscripcionPorTicket,
  canjearTicketTorneo,
} from "./tournaments.js";
import { createMockPrisma } from "../../test/mock-prisma";

function setupTestData(mock: any) {
  mock._state.categorias.push({
    id: 1,
    nombre: "Pádel",
    tipo: "CANCHA",
  });
  mock._state.servicios.push(
    {
      id: 1,
      categoriaId: 1,
      nombre: "Pista Panorámica 1",
      capacidadMaxima: 4,
      tarifa: 80000,
      modalidad: "EXCLUSIVA",
      tipoPiscina: null,
      estado: "ACTIVO",
    },
    {
      id: 2,
      categoriaId: 1,
      nombre: "Pista Panorámica 2",
      capacidadMaxima: 4,
      tarifa: 80000,
      modalidad: "EXCLUSIVA",
      tipoPiscina: null,
      estado: "ACTIVO",
    },
  );
  mock._state.usuarios.push({
    id: "admin-1",
    nombre: "Admin Torneo",
    correo: "admin@sportcomplex.com",
    rolId: 1,
  });
  mock._state.usuarios.push({
    id: "user-1",
    nombre: "Jugador Uno",
    correo: "jugador1@gmail.com",
    rolId: 2,
  });
  mock._state.usuarios.push({
    id: "user-2",
    nombre: "Jugador Dos",
    correo: "jugador2@gmail.com",
    rolId: 2,
  });
  mock._state.usuarios.push({
    id: "staff-1",
    nombre: "Portería Acceso",
    correo: "porteria@sportcomplex.com",
    rolId: 3,
  });
}

test("TSK-BD-12: crearTorneo valida campos requeridos y fechas coherentes", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  await assert.rejects(
    () =>
      crearTorneo(
        {
          adminId: "admin-1",
          categoriaId: 1,
          titulo: "",
          nivel: "Segunda",
          fechaInicio: new Date("2026-11-01T10:00:00Z"),
          fechaFin: new Date("2026-11-01T18:00:00Z"),
          cuposTotales: 16,
        },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "VALIDATION_ERROR",
  );

  await assert.rejects(
    () =>
      crearTorneo(
        {
          adminId: "admin-1",
          categoriaId: 1,
          titulo: "Torneo Primavera",
          nivel: "Segunda",
          fechaInicio: new Date("2026-11-01T18:00:00Z"),
          fechaFin: new Date("2026-11-01T10:00:00Z"), // fecha fin antes de inicio
          cuposTotales: 16,
        },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "VALIDATION_ERROR",
  );

  await assert.rejects(
    () =>
      crearTorneo(
        {
          adminId: "admin-1",
          categoriaId: 1,
          titulo: "Torneo Primavera",
          nivel: "Segunda",
          fechaInicio: new Date("2026-11-01T10:00:00Z"),
          fechaFin: new Date("2026-11-01T18:00:00Z"),
          cuposTotales: 0,
        },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "VALIDATION_ERROR",
  );
});

test("TSK-BD-12: crearTorneo registra torneo con bloqueos de pistas asociados", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Relámpago Nocturno de Pádel",
      descripcion: "Fase de grupos y eliminatoria",
      nivel: "Segunda & Tercera Categoría",
      fechaInicio: new Date("2026-11-01T18:00:00Z"),
      fechaFin: new Date("2026-11-01T23:00:00Z"),
      cuposTotales: 8,
      precioInscripcion: 50000,
      bloqueos: [
        {
          servicioId: 1,
          horaInicio: new Date("2026-11-01T18:00:00Z"),
          horaFin: new Date("2026-11-01T23:00:00Z"),
        },
        {
          servicioId: 2,
          horaInicio: new Date("2026-11-01T18:00:00Z"),
          horaFin: new Date("2026-11-01T23:00:00Z"),
        },
      ],
    },
    { db: mock },
  );

  assert.ok(torneo.id);
  assert.equal(torneo.titulo, "Torneo Relámpago Nocturno de Pádel");
  assert.equal(torneo.estado, "BORRADOR");
  assert.equal(torneo.cuposTotales, 8);
  assert.equal(torneo.cuposOcupados, 0);
  assert.equal(torneo.bloqueos.length, 2);
  assert.equal(torneo.categoria.nombre, "Pádel");
});

test("TSK-BD-12: listarTorneos y actualizarEstadoTorneo", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Pádel Open",
      nivel: "Abierto",
      fechaInicio: new Date("2026-11-10T10:00:00Z"),
      fechaFin: new Date("2026-11-10T20:00:00Z"),
      cuposTotales: 16,
    },
    { db: mock },
  );

  const detalle = await obtenerTorneoPorId(torneo.id, { db: mock });
  assert.equal(detalle.id, torneo.id);
  assert.equal(detalle.titulo, "Torneo Pádel Open");

  const listaBorrador = await listarTorneos({ estado: "BORRADOR" }, { db: mock });
  assert.equal(listaBorrador.length, 1);

  const actualizado = await actualizarEstadoTorneo(
    torneo.id,
    "INSCRIPCIONES_ABIERTAS",
    { db: mock },
  );
  assert.equal(actualizado.estado, "INSCRIPCIONES_ABIERTAS");

  const listaAbiertos = await listarTorneos({ estado: "INSCRIPCIONES_ABIERTAS" }, { db: mock });
  assert.equal(listaAbiertos.length, 1);
});

test("TSK-BD-12: inscribirUsuarioTorneo valida estado, cupos y previene duplicados", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Master Pádel 2 Cupos",
      nivel: "Primera",
      fechaInicio: new Date("2026-11-15T10:00:00Z"),
      fechaFin: new Date("2026-11-15T18:00:00Z"),
      cuposTotales: 2,
      precioInscripcion: 0, // gratuito para socios
    },
    { db: mock },
  );

  // Intentar inscribir en estado BORRADOR -> debe fallar
  await assert.rejects(
    () =>
      inscribirUsuarioTorneo(
        { torneoId: torneo.id, usuarioId: "user-1" },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "REGISTRATION_CLOSED",
  );

  // Abrir inscripciones
  await actualizarEstadoTorneo(torneo.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  // Inscribir primer participante
  const insc1 = await inscribirUsuarioTorneo(
    { torneoId: torneo.id, usuarioId: "user-1", nombrePareja: "Pareja Uno" },
    { db: mock },
  );
  assert.equal(insc1.estado, "CONFIRMADA");
  assert.equal(insc1.ticketEstado, "EMITIDO");
  assert.ok(insc1.ticketCodigoUuid);

  // Inscribir nuevamente al mismo usuario -> debe fallar ALREADY_REGISTERED
  await assert.rejects(
    () =>
      inscribirUsuarioTorneo(
        { torneoId: torneo.id, usuarioId: "user-1" },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "ALREADY_REGISTERED",
  );

  // Inscribir segundo participante (llena el cupo)
  const insc2 = await inscribirUsuarioTorneo(
    { torneoId: torneo.id, usuarioId: "user-2" },
    { db: mock },
  );
  assert.equal(insc2.estado, "CONFIRMADA");

  // Tercer usuario intenta inscribirse -> debe fallar CAPACITY_EXCEEDED
  await assert.rejects(
    () =>
      inscribirUsuarioTorneo(
        { torneoId: torneo.id, usuarioId: "admin-1" },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "CAPACITY_EXCEEDED",
  );
});

test("TSK-BD-12: canjearTicketTorneo valida y cambia estado a USADO de forma irreversible", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Acceso Test",
      nivel: "Abierto",
      fechaInicio: new Date("2026-11-20T10:00:00Z"),
      fechaFin: new Date("2026-11-20T18:00:00Z"),
      cuposTotales: 10,
    },
    { db: mock },
  );
  await actualizarEstadoTorneo(torneo.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  const inscripcion = await inscribirUsuarioTorneo(
    { torneoId: torneo.id, usuarioId: "user-1", confirmado: true },
    { db: mock },
  );

  // Consultar por ticket
  const ticketInfo = await obtenerInscripcionPorTicket(
    inscripcion.ticketCodigoUuid!,
    { db: mock },
  );
  assert.equal(ticketInfo.id, inscripcion.id);
  assert.equal(ticketInfo.ticketEstado, "EMITIDO");

  // Canjear en puerta por el empleado
  const canjeado = await canjearTicketTorneo(
    inscripcion.ticketCodigoUuid!,
    "staff-1",
    { db: mock },
  );
  assert.equal(canjeado.ticketEstado, "USADO");
  assert.equal(canjeado.ticketUsadoPor, "staff-1");
  assert.ok(canjeado.ticketUsadoEn);

  // Segundo canje -> rechazo por ALREADY_USED
  await assert.rejects(
    () =>
      canjearTicketTorneo(
        inscripcion.ticketCodigoUuid!,
        "staff-1",
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "ALREADY_USED",
  );
});
