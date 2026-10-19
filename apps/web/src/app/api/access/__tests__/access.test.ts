/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const SECRET = "test-qr-secret";
process.env.QR_HMAC_SECRET = SECRET;

const { createMockPrisma } = await import("@db-test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

// Importar el orquestador DESPUÉS de inyectar el mock de Prisma.
const { procesarEscaneo, AccessError } = await import("@/lib/api/access");
const { handleAccess } = await import("@/app/api/access/route");
const { TicketError } = await import("@sportcomplex/db");
const { signTicket } = await import("@sportcomplex/core");
const { signTicket: signTicketWithWindow } = await import("@sportcomplex/security");

const CODIGO = "9f0d6f4e-0000-4000-8000-0000000000ff";
const EMPLEADO = "lector-1";
// Ventana: 2026-10-10 10:00–11:00 (Bogotá) = 15:00Z–16:00Z.
const ADENTRO = new Date("2026-10-10T15:30:00.000Z");
const FUERA = new Date("2026-10-10T17:00:00.000Z");

function seed({
  asignacion = true,
  serviceNames = ["Cancha 1", "Piscina"],
  stationServiceEstado = "ACTIVO",
}: {
  asignacion?: boolean;
  serviceNames?: [string, string];
  stationServiceEstado?: string;
} = {}) {
  // Estado limpio: cada test arranca con UN solo ticket EMITIDO.
  for (const key of [
    "usuarios",
    "servicios",
    "franjas",
    "disponibilidades",
    "reservas",
    "tickets",
    "lecturas",
    "asignaciones",
  ] as const) {
    mock._state[key].length = 0;
  }
  mock._state.usuarios.push(
    {
      id: EMPLEADO,
      nombre: "Lectora X",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "EMPLEADO_LECTOR",
    },
    {
      id: "user-1",
      nombre: "Cliente Uno",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 3,
      rolNombre: "CLIENTE",
    },
  );
  mock._state.servicios.push({
    id: 1,
    categoriaId: 1,
    nombre: serviceNames[0],
    capacidadMaxima: 10,
    tarifa: 75000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  });
  mock._state.servicios.push({
    id: 2,
    categoriaId: 1,
    nombre: serviceNames[1],
    capacidadMaxima: 30,
    tarifa: 25000,
    modalidad: "AFORO",
    tipoPiscina: "PUBLICA",
    estado: stationServiceEstado,
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
    codigoUuid: CODIGO,
    usadoPor: null,
    estado: "EMITIDO",
    usadoEn: null,
  });
  if (asignacion) {
    mock._state.asignaciones.push({
      id: 1,
      empleadoId: EMPLEADO,
      servicioId: 1,
      inicioTurno: new Date("2026-10-10T14:00:00.000Z"),
      finTurno: new Date("2026-10-10T18:00:00.000Z"),
    });
  }
}

function scan(postServiceId: number | null, signature?: string) {
  return procesarEscaneo(
    {
      ticketId: CODIGO,
      signature: signature ?? signTicket(CODIGO, SECRET),
      postServiceId,
    },
    { empleadoId: EMPLEADO, qrSecret: SECRET, now: ADENTRO },
  );
}

test("TSK-BD-10 API: firma HMAC inválida se rechaza con 400 y sin crear auditorías", async () => {
  seed();
  await assert.rejects(
    () => scan(1, "firma-adulterada"),
    (err: unknown) =>
      err instanceof AccessError && err.code === "INVALID_SIGNATURE" && err.status === 400,
  );
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});

test("TSK-BE-31: ticket consolidado autoriza el acceso durante la ventana completa firmada", async () => {
  seed();
  const start = new Date("2026-10-10T15:00:00.000Z");
  const end = new Date("2026-10-10T17:00:00.000Z");
  mock._state.tickets[0].inicioValidez = start;
  mock._state.tickets[0].finValidez = end;
  const signature = signTicketWithWindow(CODIGO, SECRET, { start, end });

  const result = await procesarEscaneo(
    { ticketId: CODIGO, signature, postServiceId: 1 },
    { empleadoId: EMPLEADO, qrSecret: SECRET, now: new Date("2026-10-10T16:30:00.000Z") },
  );

  assert.equal(result.access, "GRANTED");
  assert.equal(result.ticket.horaInicio, "10:00:00");
  assert.equal(result.ticket.horaFin, "12:00:00");
});

test("TSK-BE-31: modificar la ventana persistida invalida la firma HMAC del ticket", async () => {
  seed();
  const start = new Date("2026-10-10T15:00:00.000Z");
  const signedEnd = new Date("2026-10-10T17:00:00.000Z");
  mock._state.tickets[0].inicioValidez = start;
  mock._state.tickets[0].finValidez = new Date("2026-10-10T18:00:00.000Z");

  await assert.rejects(
    () => procesarEscaneo(
      { ticketId: CODIGO, signature: signTicketWithWindow(CODIGO, SECRET, { start, end: signedEnd }), postServiceId: 1 },
      { empleadoId: EMPLEADO, qrSecret: SECRET, now: ADENTRO },
    ),
    (error: unknown) => error instanceof AccessError && error.code === "INVALID_SIGNATURE",
  );
  assert.equal(mock._state.lecturas.length, 0);
});

test("TSK-BE-11 (CRITERIO): UUID alterado con firma válida de otro código se rechaza sin tocar la BD", async () => {
  seed();
  // UUID con formato válido pero distinto del que firmó el QR: la firma ya no
  // corresponde. Debe fallar en la verificación HMAC, ANTES de consultar la BD.
  const alterado = "9f0d6f4e-0000-4000-8000-00000000beef";
  await assert.rejects(
    () =>
      procesarEscaneo(
        {
          ticketId: alterado,
          signature: signTicket(CODIGO, SECRET),
          postServiceId: 1,
        },
        { empleadoId: EMPLEADO, qrSecret: SECRET, now: ADENTRO },
      ),
    (err: unknown) =>
      err instanceof AccessError && err.code === "INVALID_SIGNATURE" && err.status === 400,
  );
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});

test("TSK-BD-10 API: escaneo TURNO válido concede, canjea EMITIDO→USADO y audita con su asignación", async () => {
  seed();
  const res = await scan(1);

  assert.equal(res.access, "GRANTED");
  assert.equal(res.code, undefined);
  assert.equal(res.modo, "TURNO");
  assert.equal(res.resultado, "CONCEDIDO");
  assert.equal(res.canjeado, true);
  assert.equal(res.ticket.estado, "USADO");

  assert.equal(mock._state.tickets[0].estado, "USADO");
  assert.equal(mock._state.tickets[0].usadoPor, EMPLEADO);
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].asignacionId, 1);
});

test("TSK-BD-10 API (CRITERIO): segundo escaneo del mismo QR → DENIED ALREADY_USED, boleto intacto y 2 auditorías", async () => {
  seed();
  const primera = await scan(1);
  assert.equal(primera.access, "GRANTED");

  const segunda = await scan(1);
  assert.equal(segunda.access, "DENIED");
  assert.equal(segunda.code, "ALREADY_USED");
  assert.equal(segunda.resultado, "DENEGADO_USADO");
  assert.equal(segunda.canjeado, false);
  assert.equal(segunda.ticket.estado, "USADO");

  assert.equal(mock._state.tickets[0].estado, "USADO");
  assert.equal(
    mock._state.tickets[0].usadoEn,
    mock._state.lecturas[0].fechaHora, // no se re-escribe en la denegación
  );
  assert.deepEqual(
    mock._state.lecturas.map((l: any) => l.resultado),
    ["CONCEDIDO", "DENEGADO_USADO"],
  );
});

test("TSK-BD-10 API: servicio del puesto ≠ servicio de la reserva → DENIED SERVICE_MISMATCH sin consumir", async () => {
  seed();
  const res = await scan(2);

  assert.equal(res.access, "DENIED");
  assert.equal(res.code, "SERVICE_MISMATCH");
  assert.equal(
    res.message,
    "Acceso denegado: El tiquete pertenece a Cancha 1 y se encuentra en Piscina",
  );
  assert.equal(res.modo, "TURNO");
  assert.equal(res.resultado, "DENEGADO_SERVICIO");
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_SERVICIO");
});

test("TSK-BE-16: la ruta de escaneo devuelve 403 con servicios identificados y audita sin alterar el tiquete", async () => {
  seed({
    serviceNames: ["Piscina", "Canchas"],
    stationServiceEstado: "INHABILITADO",
  });
  const request = new Request("http://localhost:3000/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId: CODIGO,
      signature: signTicket(CODIGO, SECRET),
      postServiceId: 2,
    }),
  });

  const response = await handleAccess(request, async () => ({
    user: { id: EMPLEADO, role: "EMPLEADO_LECTOR" },
  }));
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "SERVICE_MISMATCH");
  assert.equal(mock._state.servicios[1].estado, "INHABILITADO");
  assert.equal(
    body.error.message,
    "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas",
  );
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.tickets[0].usadoPor, null);
  assert.equal(mock._state.tickets[0].usadoEn, null);
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_SERVICIO");
});

test("TSK-BE-16: un identificador de puesto inexistente devuelve HTTP 404 sin auditar ni alterar el tiquete", async () => {
  seed();
  const request = new Request("http://localhost:3000/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId: CODIGO,
      signature: signTicket(CODIGO, SECRET),
      postServiceId: 999,
    }),
  });
  const response = await handleAccess(request, async () => ({
    user: { id: EMPLEADO },
  }));
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "SERVICE_NOT_FOUND");
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.tickets[0].usadoPor, null);
  assert.equal(mock._state.tickets[0].usadoEn, null);
});

test("TSK-BD-10 API: fuera de la franja → DENIED WINDOW_EXPIRED (DENEGADO_HORARIO) y auditoría", async () => {
  seed();
  const res = await procesarEscaneo(
    {
      ticketId: CODIGO,
      signature: signTicket(CODIGO, SECRET),
      postServiceId: 1,
    },
    { empleadoId: EMPLEADO, qrSecret: SECRET, now: FUERA },
  );

  assert.equal(res.access, "DENIED");
  assert.equal(res.code, "WINDOW_EXPIRED");
  assert.equal(res.message, "Acceso denegado: Franja horaria vencida");
  assert.equal(res.resultado, "DENEGADO_HORARIO");
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_HORARIO");
});

test("TSK-BD-10 API (CRITERIO): modo CONSULTA no altera el boleto, audita CONSULTA con asignación nula y devuelve datos al UI", async () => {
  seed();
  const res = await scan(null);

  assert.equal(res.access, "GRANTED");
  assert.equal(res.modo, "CONSULTA");
  assert.equal(res.resultado, "CONSULTA");
  assert.equal(res.canjeado, false);
  assert.equal(res.lecturaId > 0n, true);

  // Boleto intacto (RN-05).
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.tickets[0].usadoPor, null);

  // Auditoría obligatoria con asignacion_id nulo en consulta (RF-15).
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].modo, "CONSULTA");
  assert.equal(mock._state.lecturas[0].resultado, "CONSULTA");
  assert.equal(mock._state.lecturas[0].asignacionId, null);

  // Payload para el UI: ventana, servicio y titular (HU-16).
  assert.equal(res.ticket.titularNombre, "Cliente Uno");
  assert.equal(res.ticket.servicioNombre, "Cancha 1");
  assert.equal(res.ticket.fecha, "2026-10-10");
  assert.equal(res.ticket.horaInicio, "10:00:00");
  assert.equal(res.ticket.horaFin, "11:00:00");
  assert.equal(res.ticket.estado, "EMITIDO");
});

test("TSK-BD-10 API: lector sin turno vigente igual concede, pero audita asignacion_id nulo (best-effort)", async () => {
  seed({ asignacion: false });
  const res = await scan(1);

  assert.equal(res.access, "GRANTED");
  assert.equal(res.resultado, "CONCEDIDO");
  assert.equal(mock._state.lecturas[0].asignacionId, null);
  assert.equal(mock._state.tickets[0].estado, "USADO");
});

test("TSK-BD-10 API: código QR inexistente → TicketError 404 y cero escrituras", async () => {
  seed();
  const otro = "9f0d6f4e-0000-4000-8000-00000000dead";
  await assert.rejects(
    () =>
      procesarEscaneo(
        { ticketId: otro, signature: signTicket(otro, SECRET), postServiceId: 1 },
        { empleadoId: EMPLEADO, qrSecret: SECRET, now: ADENTRO },
      ),
    (err: unknown) =>
      err instanceof TicketError && err.code === "TICKET_NOT_FOUND" && err.status === 404,
  );
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});
