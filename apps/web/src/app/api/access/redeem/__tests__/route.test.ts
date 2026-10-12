/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const SECRET = "test-qr-secret-for-redeem-endpoint";
const CODIGO = "9f0d6f4e-0000-4000-8000-0000000000ff";
const EMPLEADO = "lector-1";
const ADMIN = "admin-1";
const CLIENTE = "cliente-1";
const INACTIVO = "inactivo-1";

process.env.QR_HMAC_SECRET = SECRET;

const { createMockPrisma } = await import(
  "../../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { handleAccessRedeem } = await import("../route");
const { signTicket } = await import("@sportcomplex/core");

// Ventana: 2026-10-10 10:00–11:00 (Bogotá) = 15:00Z–16:00Z.
const ADENTRO = new Date("2026-10-10T15:30:00.000Z");
const FUERA = new Date("2026-10-10T17:00:00.000Z");

function seed({
  asignacion = true,
  estadoTicket = "EMITIDO",
}: {
  asignacion?: boolean;
  estadoTicket?: "EMITIDO" | "USADO";
} = {}) {
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
      nombre: "Empleado Lector",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "EMPLEADO_LECTOR",
    },
    {
      id: ADMIN,
      nombre: "Super Admin",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 1,
      rolNombre: "ADMINISTRADOR",
    },
    {
      id: CLIENTE,
      nombre: "Cliente Uno",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 3,
      rolNombre: "CLIENTE",
    },
    {
      id: INACTIVO,
      nombre: "Lector Despedido",
      estado: "INACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "EMPLEADO_LECTOR",
    },
  );

  mock._state.servicios.push(
    {
      id: 1,
      categoriaId: 1,
      nombre: "Cancha 1",
      capacidadMaxima: 10,
      tarifa: 75000,
      modalidad: "EXCLUSIVA",
      tipoPiscina: null,
      estado: "ACTIVO",
    },
    {
      id: 2,
      categoriaId: 1,
      nombre: "Piscina Olímpica",
      capacidadMaxima: 30,
      tarifa: 25000,
      modalidad: "AFORO",
      tipoPiscina: "LIBRE",
      estado: "ACTIVO",
    },
  );

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
    titularId: CLIENTE,
    cantidadCupos: 1,
  });

  mock._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: CODIGO,
    usadoPor: estadoTicket === "USADO" ? EMPLEADO : null,
    estado: estadoTicket,
    usadoEn: estadoTicket === "USADO" ? new Date("2026-10-10T15:10:00.000Z") : null,
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

function createRedeemRequest(body: unknown) {
  return new Request("http://localhost:3000/api/access/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const authAs = (id: string, role: string) => async () => ({
  user: { id, role },
});

test("TSK-BE-14 CRITERIO CLAVE: canje exitoso en modo TURNO transmuta a USADO, audita CONCEDIDO y devuelve datos del boleto", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.access, "GRANTED");
  assert.equal(body.data.modo, "TURNO");
  assert.equal(body.data.resultado, "CONCEDIDO");
  assert.equal(body.data.canjeado, true);

  // Verificación del boleto en la base de datos
  const ticketEnBd = mock._state.tickets[0];
  assert.equal(ticketEnBd.estado, "USADO");
  assert.equal(ticketEnBd.usadoPor, EMPLEADO);
  assert.ok(ticketEnBd.usadoEn instanceof Date);

  // Auditoría en LECTURA_ACCESO
  assert.equal(mock._state.lecturas.length, 1);
  const lectura = mock._state.lecturas[0];
  assert.equal(lectura.modo, "TURNO");
  assert.equal(lectura.resultado, "CONCEDIDO");
  assert.equal(lectura.empleadoId, EMPLEADO);
  assert.equal(lectura.asignacionId, 1);

  // Datos devueltos para mostrar en pantalla
  assert.equal(body.data.ticket.id, "ticket-1");
  assert.equal(body.data.ticket.reservaId, "reserva-1");
  assert.equal(body.data.ticket.estado, "USADO");
  assert.equal(body.data.ticket.servicioNombre, "Cancha 1");
  assert.equal(body.data.ticket.titularNombre, "Cliente Uno");
  assert.equal(body.data.ticket.fecha, "2026-10-10");
  assert.equal(body.data.ticket.horaInicio, "10:00:00");
  assert.equal(body.data.ticket.horaFin, "11:00:00");
});

test("TSK-BE-14 CRITERIO CLAVE: un segundo escaneo del mismo QR se deniega con ALREADY_USED y no altera el boleto", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);

  // Primer escaneo: éxito
  const req1 = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });
  const res1 = await handleAccessRedeem(req1, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body1 = await res1.json();
  assert.equal(body1.data.access, "GRANTED");
  assert.equal(body1.data.canjeado, true);

  const timestampPrimerCanje = mock._state.tickets[0].usadoEn;

  // Segundo escaneo: denegado
  const req2 = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });
  const res2 = await handleAccessRedeem(req2, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body2 = await res2.json();

  assert.equal(res2.status, 200);
  assert.equal(body2.success, true);
  assert.equal(body2.data.access, "DENIED");
  assert.equal(body2.data.code, "ALREADY_USED");
  assert.equal(body2.data.resultado, "DENEGADO_USADO");
  assert.equal(body2.data.modo, "TURNO");
  assert.equal(body2.data.canjeado, false);

  // El boleto permanece USADO sin modificar el timestamp original
  assert.equal(mock._state.tickets[0].estado, "USADO");
  assert.equal(mock._state.tickets[0].usadoEn, timestampPrimerCanje);

  // Se registra exactamente una segunda fila de auditoría para la denegación
  assert.equal(mock._state.lecturas.length, 2);
  assert.equal(mock._state.lecturas[1].modo, "TURNO");
  assert.equal(mock._state.lecturas[1].resultado, "DENEGADO_USADO");
});

test("TSK-BE-14: firma HMAC inválida se rechaza con 400 antes de consultar la BD", async () => {
  seed();
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature: "0".repeat(64), // firma alterada
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_SIGNATURE");
  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});

test("TSK-BE-14: UUID alterado con firma ajena se rechaza con 400 sin alterar la BD", async () => {
  seed();
  const alterado = "9f0d6f4e-0000-4000-8000-0000000000aa";
  const req = createRedeemRequest({
    ticketId: alterado,
    signature: signTicket(CODIGO, SECRET),
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_SIGNATURE");
  assert.equal(mock._state.lecturas.length, 0);
});

test("TSK-BE-14: payload sin postServiceId o con null se rechaza con 400 (modo turno exige puesto)", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);

  const reqNull = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: null,
  });
  const resNull = await handleAccessRedeem(reqNull, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const bodyNull = await resNull.json();

  assert.equal(resNull.status, 400);
  assert.equal(bodyNull.success, false);
  assert.equal(bodyNull.error.code, "VALIDATION_ERROR");

  const reqMissing = createRedeemRequest({
    ticketId: CODIGO,
    signature,
  });
  const resMissing = await handleAccessRedeem(reqMissing, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const bodyMissing = await resMissing.json();

  assert.equal(resMissing.status, 400);
  assert.equal(bodyMissing.success, false);
  assert.equal(bodyMissing.error.code, "VALIDATION_ERROR");

  // postServiceId: true no debe ser coercionado a 1 por z.coerce.number()
  const reqBoolean = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: true,
  });
  const resBoolean = await handleAccessRedeem(reqBoolean, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const bodyBoolean = await resBoolean.json();

  assert.equal(resBoolean.status, 400);
  assert.equal(bodyBoolean.success, false);
  assert.equal(bodyBoolean.error.code, "VALIDATION_ERROR");
});

test("TSK-BE-14: discrepancia de servicio (SERVICE_MISMATCH) deniega acceso sin consumir el ticket", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  // Boleto es para Cancha 1 (id: 1), pero el empleado pasa postServiceId: 2 (Piscina)
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 2,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.access, "DENIED");
  assert.equal(body.data.code, "SERVICE_MISMATCH");
  assert.equal(body.data.resultado, "DENEGADO_SERVICIO");
  assert.equal(body.data.canjeado, false);

  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_SERVICIO");
});

test("TSK-BE-14: fuera de la franja horaria deniega acceso con WINDOW_EXPIRED (DENEGADO_HORARIO)", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: FUERA,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.access, "DENIED");
  assert.equal(body.data.code, "WINDOW_EXPIRED");
  assert.equal(body.data.message, "Acceso denegado: Franja horaria vencida");
  assert.equal(body.data.resultado, "DENEGADO_HORARIO");
  assert.equal(body.data.canjeado, false);

  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_HORARIO");
});

test("TSK-BE-17 CRITERIO CLAVE: tiquete 10:00–11:00 con hora actual 10:15 se valida; a las 11:01 se deniega con 'Acceso denegado: Franja horaria vencida'", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);

  // 1. A las 10:15 (Bogotá) = 15:15Z: el boleto 10:00–11:00 se valida y canjea con éxito
  const at1015 = new Date("2026-10-10T15:15:00.000Z");
  const req1015 = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });
  const res1015 = await handleAccessRedeem(req1015, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: at1015,
  });
  const body1015 = await res1015.json();

  assert.equal(res1015.status, 200);
  assert.equal(body1015.success, true);
  assert.equal(body1015.data.access, "GRANTED");
  assert.equal(body1015.data.resultado, "CONCEDIDO");
  assert.equal(body1015.data.canjeado, true);
  assert.equal(mock._state.tickets[0].estado, "USADO");

  // 2. A las 11:01 (Bogotá) = 16:01Z: sobre un ticket emitido se deniega con "Acceso denegado: Franja horaria vencida"
  seed(); // re-sembrar estado limpio con ticket en EMITIDO
  const at1101 = new Date("2026-10-10T16:01:00.000Z");
  const req1101 = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });
  const res1101 = await handleAccessRedeem(req1101, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: at1101,
  });
  const body1101 = await res1101.json();

  assert.equal(res1101.status, 200);
  assert.equal(body1101.success, true);
  assert.equal(body1101.data.access, "DENIED");
  assert.equal(body1101.data.code, "WINDOW_EXPIRED");
  assert.equal(body1101.data.message, "Acceso denegado: Franja horaria vencida");
  assert.equal(body1101.data.resultado, "DENEGADO_HORARIO");
  assert.equal(body1101.data.canjeado, false);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
  assert.equal(mock._state.lecturas.length, 1);
  assert.equal(mock._state.lecturas[0].resultado, "DENEGADO_HORARIO");
});

test("TSK-BE-17: límites exactos de franja [10:00:00, 11:00:00] (Bogotá) se validan y 09:59:59 se deniega", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);

  // Antes de las 10:00 (09:59:59 Bogotá = 14:59:59Z) -> DENEGADO_HORARIO
  const at0959 = new Date("2026-10-10T14:59:59.000Z");
  const resEarly = await handleAccessRedeem(
    createRedeemRequest({ ticketId: CODIGO, signature, postServiceId: 1 }),
    { authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"), now: at0959 },
  );
  const bodyEarly = await resEarly.json();
  assert.equal(bodyEarly.data.access, "DENIED");
  assert.equal(bodyEarly.data.code, "WINDOW_EXPIRED");
  assert.equal(bodyEarly.data.message, "Acceso denegado: Franja horaria vencida");
  assert.equal(bodyEarly.data.resultado, "DENEGADO_HORARIO");

  // En punto 10:00:00 (15:00:00Z) -> GRANTED (límite inferior inclusivo)
  seed();
  const at1000 = new Date("2026-10-10T15:00:00.000Z");
  const resStart = await handleAccessRedeem(
    createRedeemRequest({ ticketId: CODIGO, signature, postServiceId: 1 }),
    { authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"), now: at1000 },
  );
  const bodyStart = await resStart.json();
  assert.equal(bodyStart.data.access, "GRANTED");
  assert.equal(bodyStart.data.canjeado, true);

  // En punto 11:00:00 (16:00:00Z) -> GRANTED (límite superior inclusivo)
  seed();
  const at1100 = new Date("2026-10-10T16:00:00.000Z");
  const resEnd = await handleAccessRedeem(
    createRedeemRequest({ ticketId: CODIGO, signature, postServiceId: 1 }),
    { authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"), now: at1100 },
  );
  const bodyEnd = await resEnd.json();
  assert.equal(bodyEnd.data.access, "GRANTED");
  assert.equal(bodyEnd.data.canjeado, true);
});

test("TSK-BE-14: rol Cliente o petición no autenticada se rechaza antes de procesar", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  // Sin sesión
  const resNoAuth = await handleAccessRedeem(req, {
    authenticate: async () => null,
    now: ADENTRO,
  });
  assert.equal(resNoAuth.status, 401);

  // Con rol CLIENTE
  const resCliente = await handleAccessRedeem(req, {
    authenticate: authAs(CLIENTE, "CLIENTE"),
    now: ADENTRO,
  });
  assert.equal(resCliente.status, 403);

  // Con empleado inactivo
  const resInactivo = await handleAccessRedeem(req, {
    authenticate: authAs(INACTIVO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  assert.equal(resInactivo.status, 403);

  assert.equal(mock._state.lecturas.length, 0);
  assert.equal(mock._state.tickets[0].estado, "EMITIDO");
});

test("TSK-BE-14: código inexistente en base de datos retorna 404 TICKET_NOT_FOUND", async () => {
  seed();
  const inexistente = "9f0d6f4e-0000-4000-8000-000000009999";
  const req = createRedeemRequest({
    ticketId: inexistente,
    signature: signTicket(inexistente, SECRET),
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "TICKET_NOT_FOUND");
  assert.equal(mock._state.lecturas.length, 0);
});

test("TSK-BE-14: Administrador también está autorizado para canjear tickets en modo turno", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(ADMIN, "ADMINISTRADOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.access, "GRANTED");
  assert.equal(body.data.canjeado, true);
  assert.equal(mock._state.tickets[0].estado, "USADO");
  assert.equal(mock._state.tickets[0].usadoPor, ADMIN);
});

test("TSK-BE-14: lector sin turno previo igual canjea pero audita asignacion_id nulo (best-effort)", async () => {
  seed({ asignacion: false });
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.access, "GRANTED");
  assert.equal(body.data.canjeado, true);
  assert.equal(mock._state.lecturas[0].asignacionId, null);
  assert.equal(mock._state.tickets[0].estado, "USADO");
});

test("TSK-BE-14: sin QR_HMAC_SECRET configurado responde 503 QR_NOT_CONFIGURED", async () => {
  const secretOriginal = process.env.QR_HMAC_SECRET;
  delete process.env.QR_HMAC_SECRET;
  try {
    const req = createRedeemRequest({
      ticketId: CODIGO,
      signature: "0".repeat(64),
      postServiceId: 1,
    });
    const res = await handleAccessRedeem(req, {
      authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
      now: ADENTRO,
    });
    const body = await res.json();

    assert.equal(res.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "QR_NOT_CONFIGURED");
  } finally {
    process.env.QR_HMAC_SECRET = secretOriginal;
  }
});

test("TSK-BE-14: cuerpo no parseable como JSON responde 400 INVALID_PAYLOAD", async () => {
  seed();
  const req = new Request("http://localhost:3000/api/access/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "esto-no-es-json-valido{",
  });

  const res = await handleAccessRedeem(req, {
    authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
    now: ADENTRO,
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_PAYLOAD");
});

test("TSK-BE-14: error no controlado en base de datos responde 500 SERVER_ERROR", async () => {
  seed();
  const signature = signTicket(CODIGO, SECRET);
  const req = createRedeemRequest({
    ticketId: CODIGO,
    signature,
    postServiceId: 1,
  });

  // Forzar error inesperado mockeando findUnique para lanzar una excepción no de negocio
  const originalFindUnique = mock.ticketQr.findUnique;
  mock.ticketQr.findUnique = async () => {
    throw new Error("Fallo catastrófico de conexión a base de datos");
  };

  try {
    const res = await handleAccessRedeem(req, {
      authenticate: authAs(EMPLEADO, "EMPLEADO_LECTOR"),
      now: ADENTRO,
    });
    const body = await res.json();

    assert.equal(res.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SERVER_ERROR");
  } finally {
    mock.ticketQr.findUnique = originalFindUnique;
  }
});

