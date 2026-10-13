/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import {
  TournamentError,
  crearTorneo,
  listarTorneos,
  obtenerTorneoPorId,
  actualizarEstadoTorneo,
  actualizarTorneo,
  eliminarTorneo,
  liberarBloqueosTorneo,
  inscribirUsuarioTorneo,
  obtenerInscripcionPorTicket,
  canjearTicketTorneo,
  verificarPagoParaTorneo,
  obtenerDetallePublicoTorneo,
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

  // ARC-04: Transición inválida (INSCRIPCIONES_ABIERTAS -> BORRADOR) debe ser rechazada
  await assert.rejects(
    () => actualizarEstadoTorneo(torneo.id, "BORRADOR", { db: mock }),
    (err: any) => err instanceof TournamentError && err.code === "INVALID_STATE_TRANSITION",
  );
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

test("TSK-BE-25: Motor de bloqueo preventivo y detección de conflictos", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  // Crear franja y disponibilidad para la pista 1
  mock._state.franjas.push({
    id: 1,
    servicioId: 1,
    diaSemana: 7, // Domingo
    horaInicio: new Date("1970-01-01T10:00:00Z"),
    horaFin: new Date("1970-01-01T14:00:00Z"),
  });
  mock._state.disponibilidades.push({
    id: 101n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date("2026-11-01T00:00:00.000Z"),
    cuposTotales: 1,
    cuposOcupados: 0,
    bloqueadaMantenimiento: false,
  });

  // 1. Torneo se crea exitosamente y bloquea la pista 1 (horario legal Colombia -05:00)
  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Masters Pádel",
      nivel: "Primera",
      fechaInicio: new Date("2026-11-01T10:00:00-05:00"),
      fechaFin: new Date("2026-11-01T14:00:00-05:00"),
      cuposTotales: 8,
      bloqueos: [
        {
          servicioId: 1,
          horaInicio: new Date("2026-11-01T10:00:00-05:00"),
          horaFin: new Date("2026-11-01T14:00:00-05:00"),
        },
      ],
    },
    { db: mock },
  );

  const disp = mock._state.disponibilidades.find((d: any) => d.id === 101n);
  assert.equal(disp.bloqueadaMantenimiento, true, "La franja debió quedar bloqueada por el torneo");

  // 2. Al cancelar el torneo, la pista debe liberarse si no hay inhabilitación
  await actualizarEstadoTorneo(torneo.id, "CANCELADO", { db: mock });
  assert.equal(disp.bloqueadaMantenimiento, false, "La franja debió liberarse tras cancelar el torneo");

  // 2b. ARC-03: Si la pista tiene una inhabilitación activa, liberar bloqueos no reactiva la franja
  mock._state.inhabilitaciones.push({
    id: 1,
    servicioId: 1,
    adminId: "admin-1",
    motivo: "Filtración de agua",
    fechaInicio: new Date("2026-11-01T00:00:00.000Z"),
    fechaFin: new Date("2026-11-02T00:00:00.000Z"),
  });
  disp.bloqueadaMantenimiento = true;
  await liberarBloqueosTorneo(torneo.id, { db: mock });
  assert.equal(
    disp.bloqueadaMantenimiento,
    true,
    "La franja debe permanecer bloqueada si hay una inhabilitación activa (ARC-03)",
  );

  // 3. Si hay una reserva confirmada activa en ese horario, se rechaza la creación del torneo
  mock._state.reservas.push({
    id: "res-existente",
    disponibilidadId: 101n,
    estado: "CONFIRMADA",
    titularId: "user-1",
    cantidadCupos: 1,
  });

  await assert.rejects(
    () =>
      crearTorneo(
        {
          adminId: "admin-1",
          categoriaId: 1,
          titulo: "Torneo Rechazado Por Conflicto",
          nivel: "Primera",
          fechaInicio: new Date("2026-11-01T10:00:00-05:00"),
          fechaFin: new Date("2026-11-01T14:00:00-05:00"),
          cuposTotales: 8,
          bloqueos: [
            {
              servicioId: 1,
              horaInicio: new Date("2026-11-01T10:00:00-05:00"),
              horaFin: new Date("2026-11-01T14:00:00-05:00"),
            },
          ],
        },
        { db: mock },
      ),
    (err: any) => err instanceof TournamentError && err.code === "COURT_SLOT_CONFLICT",
  );
});

test("TSK-BE-25: actualizarTorneo y eliminarTorneo", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Editable",
      nivel: "Tercera",
      fechaInicio: new Date("2026-11-15T09:00:00Z"),
      fechaFin: new Date("2026-11-15T18:00:00Z"),
      cuposTotales: 12,
    },
    { db: mock },
  );

  // Actualizar datos
  const updated = await actualizarTorneo(
    torneo.id,
    {
      titulo: "Torneo Editado Exitosamente",
      cuposTotales: 16,
      precioInscripcion: 35000,
    },
    { db: mock },
  );
  assert.equal(updated.titulo, "Torneo Editado Exitosamente");
  assert.equal(updated.cuposTotales, 16);
  assert.equal(updated.precioInscripcion, 35000);

  // Eliminar torneo en borrador sin participantes
  await eliminarTorneo(torneo.id, { db: mock });
  await assert.rejects(
    () => obtenerTorneoPorId(torneo.id, { db: mock }),
    (err: any) => err instanceof TournamentError && err.code === "NOT_FOUND",
  );
});

test("TSK-BD-12: inscribirUsuarioTorneo ciclo de vida PENDIENTE_PAGO -> CONFIRMADA sin error P2002 (HIGH-03)", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo de Pago Ciclo Completo",
      nivel: "Primera",
      fechaInicio: new Date("2026-11-20T10:00:00Z"),
      fechaFin: new Date("2026-11-20T18:00:00Z"),
      cuposTotales: 4,
      precioInscripcion: 60000,
    },
    { db: mock },
  );
  await actualizarEstadoTorneo(torneo.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  // 1. Inscripción sin pago -> PENDIENTE_PAGO
  const inscPendiente = await inscribirUsuarioTorneo(
    { torneoId: torneo.id, usuarioId: "user-1", confirmado: false },
    { db: mock },
  );
  assert.equal(inscPendiente.estado, "PENDIENTE_PAGO");

  // Reintento sin pago -> devuelve la existente sin duplicar ni lanzar P2002
  const reintento = await inscribirUsuarioTorneo(
    { torneoId: torneo.id, usuarioId: "user-1", confirmado: false },
    { db: mock },
  );
  assert.equal(reintento.id, inscPendiente.id);
  assert.equal(reintento.estado, "PENDIENTE_PAGO");

  // 2. Usuario completa pago -> Transiciona a CONFIRMADA sin colisión P2002
  const inscConfirmada = await inscribirUsuarioTorneo(
    {
      torneoId: torneo.id,
      usuarioId: "user-1",
      pagoId: "00000000-0000-4000-8000-000000000001",
      confirmado: true,
    },
    { db: mock },
  );
  assert.equal(inscConfirmada.id, inscPendiente.id);
  assert.equal(inscConfirmada.estado, "CONFIRMADA");
  assert.equal(inscConfirmada.ticketEstado, "EMITIDO");

  // Verificar que el cupo ocupado aumentó en 1
  const tActualizado = await obtenerTorneoPorId(torneo.id, { db: mock });
  assert.equal(tActualizado.cuposOcupados, 1);
});

test("TSK-BD-12: verificarPagoParaTorneo valida autenticidad, usuario, estado y monto", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  mock._state.pagos.push(
    {
      id: "11111111-1111-4111-8111-111111111111",
      usuarioId: "user-1",
      tipo: "TORNEO",
      stripePaymentIntentId: "pi_aprobado_valido",
      monto: 50000,
      estado: "APROBADO",
      creadoEn: new Date(),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      usuarioId: "user-1",
      tipo: "TORNEO",
      stripePaymentIntentId: "pi_pendiente",
      monto: 50000,
      estado: "PENDIENTE",
      creadoEn: new Date(),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      usuarioId: "user-2",
      tipo: "TORNEO",
      stripePaymentIntentId: "pi_otro_usuario",
      monto: 50000,
      estado: "APROBADO",
      creadoEn: new Date(),
    },
  );

  // 1. Pago válido aprobado que cubre el monto
  const pagoValido = await verificarPagoParaTorneo(
    "11111111-1111-4111-8111-111111111111",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.ok(pagoValido);
  assert.equal(pagoValido.id, "11111111-1111-4111-8111-111111111111");

  // 2. Búsqueda por stripePaymentIntentId
  const pagoPorIntent = await verificarPagoParaTorneo(
    "pi_aprobado_valido",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.ok(pagoPorIntent);

  // 3. Pago pendiente -> null
  const pagoPendiente = await verificarPagoParaTorneo(
    "22222222-2222-4222-8222-222222222222",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.equal(pagoPendiente, null);

  // 4. Pago de otro usuario -> null
  const pagoOtroUser = await verificarPagoParaTorneo(
    "33333333-3333-4333-8333-333333333333",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.equal(pagoOtroUser, null);

  // 5. Monto insuficiente -> null
  const pagoInsuficiente = await verificarPagoParaTorneo(
    "11111111-1111-4111-8111-111111111111",
    "user-1",
    80000, // Torneo cuesta 80000 pero el pago es de 50000
    undefined,
    { db: mock },
  );
  assert.equal(pagoInsuficiente, null);
});

test("TSK-BD-12: obtenerDetallePublicoTorneo excluye lista de inscripciones (MED-02)", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const torneo = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Detalle Público Test",
      nivel: "Abierto",
      fechaInicio: new Date("2026-11-20T10:00:00Z"),
      fechaFin: new Date("2026-11-20T18:00:00Z"),
      cuposTotales: 10,
    },
    { db: mock },
  );

  const detallePublico = await obtenerDetallePublicoTorneo(torneo.id, { db: mock });
  assert.equal(detallePublico.id, torneo.id);
  assert.equal((detallePublico as any).inscripciones, undefined);
});

test("CRIT-03: verificarPagoParaTorneo rechaza pagos de tipo RESERVA o MEMBRESIA", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  mock._state.pagos.push(
    {
      id: "44444444-4444-4444-8444-444444444444",
      usuarioId: "user-1",
      tipo: "RESERVA",
      stripePaymentIntentId: "pi_reserva_aprobada",
      monto: 80000,
      estado: "APROBADO",
      creadoEn: new Date(),
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      usuarioId: "user-1",
      tipo: "MEMBRESIA",
      stripePaymentIntentId: "pi_membresia_aprobada",
      monto: 120000,
      estado: "APROBADO",
      creadoEn: new Date(),
    },
  );

  // Pago de reserva debe ser rechazado aunque cubra el monto
  const pagoReserva = await verificarPagoParaTorneo(
    "44444444-4444-4444-8444-444444444444",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.equal(pagoReserva, null);

  // Pago de membresía debe ser rechazado
  const pagoMembresia = await verificarPagoParaTorneo(
    "55555555-5555-4555-8555-555555555555",
    "user-1",
    50000,
    undefined,
    { db: mock },
  );
  assert.equal(pagoMembresia, null);
});

test("HIGH-04: inscribirUsuarioTorneo rechaza pagoId ya consumido en otra inscripción (PAYMENT_ALREADY_USED 409)", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const t1 = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo 1 Con Costo",
      nivel: "Abierto",
      fechaInicio: new Date("2026-11-20T10:00:00Z"),
      fechaFin: new Date("2026-11-20T18:00:00Z"),
      cuposTotales: 10,
      precioInscripcion: 50000,
    },
    { db: mock },
  );
  await actualizarEstadoTorneo(t1.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  const t2 = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo 2 Con Costo",
      nivel: "Abierto",
      fechaInicio: new Date("2026-12-01T10:00:00Z"),
      fechaFin: new Date("2026-12-01T18:00:00Z"),
      cuposTotales: 10,
      precioInscripcion: 50000,
    },
    { db: mock },
  );
  await actualizarEstadoTorneo(t2.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  const pagoCompartidoId = "77777777-7777-4777-8777-777777777777";

  // Primera inscripción usa el pagoId exitosamente
  const insc1 = await inscribirUsuarioTorneo(
    {
      torneoId: t1.id,
      usuarioId: "user-1",
      pagoId: pagoCompartidoId,
      confirmado: true,
    },
    { db: mock },
  );
  assert.equal(insc1.estado, "CONFIRMADA");

  // Segunda inscripción intenta reutilizar el mismo pagoId para otro torneo
  await assert.rejects(
    () =>
      inscribirUsuarioTorneo(
        {
          torneoId: t2.id,
          usuarioId: "user-1",
          pagoId: pagoCompartidoId,
          confirmado: true,
        },
        { db: mock },
      ),
    (err: any) =>
      err instanceof TournamentError &&
      err.code === "PAYMENT_ALREADY_USED" &&
      err.status === 409,
  );
});

test("MED-06: inscribirUsuarioTorneo maneja colisión de unicidad P2002 convirtiéndola a ALREADY_REGISTERED 409", async () => {
  const mock = createMockPrisma();
  setupTestData(mock);

  const t = await crearTorneo(
    {
      adminId: "admin-1",
      categoriaId: 1,
      titulo: "Torneo Concurrencia P2002",
      nivel: "Abierto",
      fechaInicio: new Date("2026-11-20T10:00:00Z"),
      fechaFin: new Date("2026-11-20T18:00:00Z"),
      cuposTotales: 10,
    },
    { db: mock },
  );
  await actualizarEstadoTorneo(t.id, "INSCRIPCIONES_ABIERTAS", { db: mock });

  // Simulamos colisión de carrera donde mock.inscripcionTorneo.create arroja P2002
  const originalCreate = mock.inscripcionTorneo.create;
  mock.inscripcionTorneo.create = async () => {
    const err = new Error(
      "Unique constraint failed on the fields: (`torneo_id`,`usuario_id`)",
    ) as Error & { code: string };
    err.code = "P2002";
    throw err;
  };

  await assert.rejects(
    () =>
      inscribirUsuarioTorneo(
        {
          torneoId: t.id,
          usuarioId: "user-1",
          confirmado: true,
        },
        { db: mock },
      ),
    (err: any) =>
      err instanceof TournamentError &&
      err.code === "ALREADY_REGISTERED" &&
      err.status === 409,
  );

  mock.inscripcionTorneo.create = originalCreate;
});

