/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "@db-test/mock-prisma";
import { parseTicketQrPayload, verifyTicketSignature } from "@sportcomplex/core";

Reflect.set(process.env, "NODE_ENV", "test");
process.env.QR_HMAC_SECRET = "test-secret-tournaments-hmac-key";

const mock = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } } | null;
}).__scAuthSession = { user: { id: "user-cliente-1" } };

// Configurar usuarios en el mock
mock._state.usuarios.push(
  {
    id: "admin-torneos",
    nombre: "Admin Principal",
    correo: "admin@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 1,
    rolNombre: "ADMINISTRADOR",
  },
  {
    id: "user-cliente-1",
    nombre: "Juan Perez",
    correo: "juan.perez@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "CLIENTE",
  },
  {
    id: "user-cliente-2",
    nombre: "Maria Rodriguez",
    correo: "maria@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "CLIENTE",
  },
  {
    id: "user-cliente-3",
    nombre: "Carlos Gomez",
    correo: "carlos@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "CLIENTE",
  },
);

mock._state.categorias.push({
  id: 1,
  nombre: "Pádel",
  tipo: "CANCHA",
});

// Import route handlers
const listRoute = await import("@/app/api/tournaments/route");
const detailRoute = await import("@/app/api/tournaments/[id]/route");
const registerRoute = await import("@/app/api/tournaments/[id]/register/route");

// IDs constantes para torneos de prueba
const TORNEO_ABIERTO_ID = "11111111-1111-4111-8111-111111111111";
const TORNEO_LLENO_ID = "22222222-2222-4222-8222-222222222222";
const TORNEO_BORRADOR_ID = "33333333-3333-4333-8333-333333333333";
const TORNEO_PAGO_ID = "44444444-4444-4444-8444-444444444444";

// Inicializar torneos de prueba
mock._state.torneos.push(
  {
    id: TORNEO_ABIERTO_ID,
    adminId: "admin-torneos",
    categoriaId: 1,
    titulo: "Torneo Abierto Pádel Primavera",
    descripcion: "Inscripciones abiertas a todos los socios",
    nivel: "Segunda",
    fechaInicio: new Date("2026-11-20T08:00:00Z"),
    fechaFin: new Date("2026-11-20T18:00:00Z"),
    cuposTotales: 4,
    cuposOcupados: 1,
    precioInscripcion: 0,
    estado: "INSCRIPCIONES_ABIERTAS",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    eliminadoEn: null,
  },
  {
    id: TORNEO_LLENO_ID,
    adminId: "admin-torneos",
    categoriaId: 1,
    titulo: "Torneo Exclusivo Cupo Lleno",
    descripcion: "Torneo sin cupos restantes",
    nivel: "Primera",
    fechaInicio: new Date("2026-11-25T08:00:00Z"),
    fechaFin: new Date("2026-11-25T18:00:00Z"),
    cuposTotales: 2,
    cuposOcupados: 2,
    precioInscripcion: 0,
    estado: "INSCRIPCIONES_ABIERTAS",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    eliminadoEn: null,
  },
  {
    id: TORNEO_BORRADOR_ID,
    adminId: "admin-torneos",
    categoriaId: 1,
    titulo: "Torneo en Preparación",
    descripcion: "Aún en borrador",
    nivel: "Tercera",
    fechaInicio: new Date("2026-12-01T08:00:00Z"),
    fechaFin: new Date("2026-12-01T18:00:00Z"),
    cuposTotales: 8,
    cuposOcupados: 0,
    precioInscripcion: 30000,
    estado: "BORRADOR",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    eliminadoEn: null,
  },
  {
    id: TORNEO_PAGO_ID,
    adminId: "admin-torneos",
    categoriaId: 1,
    titulo: "Grand Slam Pádel Con Costo",
    descripcion: "Torneo oficial con cobro de entrada",
    nivel: "Open",
    fechaInicio: new Date("2026-12-10T08:00:00Z"),
    fechaFin: new Date("2026-12-10T20:00:00Z"),
    cuposTotales: 16,
    cuposOcupados: 0,
    precioInscripcion: 45000,
    estado: "INSCRIPCIONES_ABIERTAS",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
    eliminadoEn: null,
  },
);

test("API: GET /api/tournaments retorna catálogo con cupos disponibles calculados en tiempo real", async () => {
  const req = new Request("http://localhost:3000/api/tournaments");
  const res = await listRoute.GET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));

  // Torneo abierto debe tener cupos calculados: 4 totales - 1 ocupado = 3 disponibles
  const abierto = body.data.find((t: any) => t.id === TORNEO_ABIERTO_ID);
  assert.ok(abierto);
  assert.equal(abierto.cuposDisponibles, 3);
  assert.equal(abierto.inscripcionesAbiertas, true);

  // Torneo lleno debe tener 0 cupos disponibles y inscripcionesAbiertas = false
  const lleno = body.data.find((t: any) => t.id === TORNEO_LLENO_ID);
  assert.ok(lleno);
  assert.equal(lleno.cuposDisponibles, 0);
  assert.equal(lleno.inscripcionesAbiertas, false);

  // Torneo en borrador no debe aparecer en el catálogo público activo por defecto
  const borrador = body.data.find((t: any) => t.id === TORNEO_BORRADOR_ID);
  assert.equal(borrador, undefined);
});

test("API: GET /api/tournaments/[id] retorna detalle individual de torneo", async () => {
  // 1. Rechazo por ID inválido no UUID
  const resInvalid = await detailRoute.GET(
    new Request("http://localhost:3000/api/tournaments/123"),
    { params: Promise.resolve({ id: "123" }) },
  );
  assert.equal(resInvalid.status, 400);

  // 2. 404 para ID no encontrado
  const resNotFound = await detailRoute.GET(
    new Request("http://localhost:3000/api/tournaments/00000000-0000-4000-8000-000000000000"),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }) },
  );
  assert.equal(resNotFound.status, 404);

  // 3. Detalle exitoso de torneo existente
  const resOk = await detailRoute.GET(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}`),
    { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
  );
  assert.equal(resOk.status, 200);
  const data = await resOk.json();
  assert.equal(data.success, true);
  assert.equal(data.data.id, TORNEO_ABIERTO_ID);
  assert.equal(data.data.cuposDisponibles, 3);
  assert.equal(data.data.inscripcionesAbiertas, true);
  assert.equal(data.data.yaInscrito, false);
});

test("API: POST /api/tournaments/[id]/register exige autenticación (401)", async () => {
  const savedSession = (globalThis as any).__scAuthSession;
  (globalThis as any).__scAuthSession = null;

  const resUnauth = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
  );
  assert.equal(resUnauth.status, 401);

  // Restaurar sesión
  (globalThis as any).__scAuthSession = savedSession;
});

test("API: POST /api/tournaments/[id]/register rechaza torneo no abierto (400)", async () => {
  const resClosed = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_BORRADOR_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_BORRADOR_ID }) },
  );
  assert.equal(resClosed.status, 400);
  const data = await resClosed.json();
  assert.equal(data.error.code, "REGISTRATION_CLOSED");
});

test("API: POST /api/tournaments/[id]/register inscribe exitosamente a torneo gratuito y emite Ticket QR firmado", async () => {
  // Juan Perez (user-cliente-1) se inscribe al torneo abierto
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-1" } };

  const res = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombrePareja: "Alejandro Galan",
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
  );

  assert.equal(res.status, 201);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.inscripcion.estado, "CONFIRMADA");
  assert.equal(data.data.inscripcion.nombrePareja, "Alejandro Galan");
  assert.equal(data.data.requierePago, false);

  // Validar emisión de Ticket y QR
  const ticket = data.data.ticket;
  assert.ok(ticket, "El ticket debe ser generado");
  assert.equal(ticket.estado, "EMITIDO");
  assert.ok(ticket.codigoUuid);
  assert.ok(ticket.firma);
  assert.ok(ticket.qrPayload);

  // Validar formato canónico del QR SC1:<uuid>:<firma>
  const parsedQr = parseTicketQrPayload(ticket.qrPayload);
  assert.ok(parsedQr, "El QR payload debe ser parseable por el escáner de portería");
  assert.equal(parsedQr?.ticketId, ticket.codigoUuid);

  // Validar firma criptográfica HMAC-SHA256
  const isValidSig = verifyTicketSignature(
    ticket.codigoUuid,
    ticket.firma,
    process.env.QR_HMAC_SECRET!,
  );
  assert.equal(isValidSig, true, "La firma del QR debe ser criptográficamente válida");

  // Validar que se incrementó el cupo ocupado del torneo
  const torneo = mock._state.torneos.find((t: any) => t.id === TORNEO_ABIERTO_ID);
  assert.equal(torneo.cuposOcupados, 2);
});

test("API: POST /api/tournaments/[id]/register previene inscripciones duplicadas (409 ALREADY_REGISTERED)", async () => {
  // Juan Perez intenta registrarse por segunda vez al mismo torneo
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-1" } };

  const resDup = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
  );

  assert.equal(resDup.status, 409);
  const data = await resDup.json();
  assert.equal(data.error.code, "ALREADY_REGISTERED");
});

test("API: POST /api/tournaments/[id]/register rechaza cuando no hay cupos (409 CAPACITY_EXCEEDED)", async () => {
  // Maria Rodriguez (user-cliente-2) intenta inscribirse a torneo sin cupos
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-2" } };

  const resLleno = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_LLENO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_LLENO_ID }) },
  );

  assert.equal(resLleno.status, 409);
  const data = await resLleno.json();
  assert.equal(data.error.code, "CAPACITY_EXCEEDED");
});

test("API: POST /api/tournaments/[id]/register maneja torneos con costo (PENDIENTE_PAGO vs CONFIRMADA con pago)", async () => {
  // 1. Inscripción sin pago previo provisto -> Queda PENDIENTE_PAGO
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-2" } };

  const resPendiente = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );

  assert.equal(resPendiente.status, 201);
  const dataPendiente = await resPendiente.json();
  assert.equal(dataPendiente.data.inscripcion.estado, "PENDIENTE_PAGO");
  assert.equal(dataPendiente.data.requierePago, true);
  assert.equal(dataPendiente.data.precioInscripcion, 45000);
  assert.equal(dataPendiente.data.ticket, null);

  // 2. Intento de confirmar con referencia de pago inexistente/no aprobada -> Falla 400 PAYMENT_INVALID
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-3" } };

  const resPagoInvalido = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stripePaymentIntentId: "pi_invalido_sin_registrar",
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );
  assert.equal(resPagoInvalido.status, 400);
  const dataInvalido = await resPagoInvalido.json();
  assert.equal(dataInvalido.error.code, "PAYMENT_INVALID");

  // 3. Inscripción con referencia de pago APROBADA en BD -> Queda CONFIRMADA y emite ticket
  mock._state.pagos.push({
    id: "99999999-9999-4999-8999-999999999999",
    usuarioId: "user-cliente-3",
    tipo: "TORNEO",
    stripePaymentIntentId: "pi_tourn_test_12345",
    monto: 45000,
    estado: "APROBADO",
    creadoEn: new Date(),
  });

  const resPagada = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stripePaymentIntentId: "pi_tourn_test_12345",
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );

  assert.equal(resPagada.status, 201);
  const dataPagada = await resPagada.json();
  assert.equal(dataPagada.data.inscripcion.estado, "CONFIRMADA");
  assert.equal(dataPagada.data.requierePago, false);
  assert.ok(dataPagada.data.ticket);
  assert.equal(dataPagada.data.ticket.estado, "EMITIDO");

  // 4. Ciclo de vida real (HIGH-03): user-cliente-2 paga su inscripción PENDIENTE_PAGO previa
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-2" } };

  mock._state.pagos.push({
    id: "88888888-8888-4888-8888-888888888888",
    usuarioId: "user-cliente-2",
    tipo: "TORNEO",
    stripePaymentIntentId: "pi_tourn_test_user2",
    monto: 45000,
    estado: "APROBADO",
    creadoEn: new Date(),
  });

  const resReintentoPago = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagoId: "88888888-8888-4888-8888-888888888888",
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );

  assert.equal(resReintentoPago.status, 201);
  const dataReintento = await resReintentoPago.json();
  assert.equal(dataReintento.data.inscripcion.estado, "CONFIRMADA");
  assert.ok(dataReintento.data.ticket);
  assert.equal(dataReintento.data.ticket.estado, "EMITIDO");
});

test("API: POST /api/tournaments/[id]/register retorna 503 QR_NOT_CONFIGURED si falta QR_HMAC_SECRET (HIGH-01)", async () => {
  const originalSecret = process.env.QR_HMAC_SECRET;
  delete process.env.QR_HMAC_SECRET;

  try {
    (globalThis as any).__scAuthSession = { user: { id: "user-cliente-1" } };
    const res = await registerRoute.POST(
      new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
    );

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error.code, "QR_NOT_CONFIGURED");
  } finally {
    process.env.QR_HMAC_SECRET = originalSecret;
  }
});

test("API: GET /api/tournaments rechaza estado=BORRADOR en catálogo público (MED-03)", async () => {
  const req = new Request("http://localhost:3000/api/tournaments?estado=BORRADOR");
  const res = await listRoute.GET(req);
  assert.equal(res.status, 400);

  const body = await res.json();
  assert.equal(body.error.code, "INVALID_FILTER");
});

test("API: GET /api/tournaments/[id] oculta torneos en BORRADOR a clientes (MED-03)", async () => {
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-1" } };
  const res = await detailRoute.GET(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_BORRADOR_ID}`),
    { params: Promise.resolve({ id: TORNEO_BORRADOR_ID }) },
  );
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "NOT_FOUND");
});

test("API: POST /api/tournaments/[id]/register rechaza roles no autorizados (403)", async () => {
  mock._state.usuarios.push({
    id: "staff-lector",
    nombre: "Lector Porteria",
    correo: "lector@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 3,
    rolNombre: "EMPLEADO_LECTOR",
  });

  (globalThis as any).__scAuthSession = { user: { id: "staff-lector" } };

  const res = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_ABIERTO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
    { params: Promise.resolve({ id: TORNEO_ABIERTO_ID }) },
  );

  assert.equal(res.status, 403);
});

test("API: POST /api/tournaments/[id]/register rechaza pagos que no sean de tipo TORNEO (CRIT-03)", async () => {
  mock._state.usuarios.push({
    id: "user-cliente-4",
    nombre: "Laura Sanchez",
    correo: "laura@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "CLIENTE",
  });

  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-4" } };

  // Crear pago de tipo RESERVA para el usuario
  mock._state.pagos.push({
    id: "77777777-1111-4111-8111-777777777777",
    usuarioId: "user-cliente-4",
    tipo: "RESERVA",
    stripePaymentIntentId: "pi_reserva_bypass_attempt",
    monto: 80000,
    estado: "APROBADO",
    creadoEn: new Date(),
  });

  const res = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagoId: "77777777-1111-4111-8111-777777777777",
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "PAYMENT_INVALID");
});

test("API: POST /api/tournaments/[id]/register rechaza pago ya consumido en otra inscripción (HIGH-04)", async () => {
  mock._state.usuarios.push({
    id: "user-cliente-5",
    nombre: "Pedro Pascal",
    correo: "pedro@sportcomplex.com",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "CLIENTE",
  });

  const pagoDuplicadoId = "99999999-5555-4555-8555-999999999999";
  mock._state.pagos.push({
    id: pagoDuplicadoId,
    usuarioId: "user-cliente-5",
    tipo: "TORNEO",
    stripePaymentIntentId: "pi_torneo_consumido",
    monto: 45000,
    estado: "APROBADO",
    creadoEn: new Date(),
  });

  mock._state.inscripcionesTorneo.push({
    id: "inscripcion-previa-existente",
    torneoId: TORNEO_ABIERTO_ID,
    usuarioId: "user-cliente-5",
    nombrePareja: null,
    pagoId: pagoDuplicadoId,
    estado: "CONFIRMADA",
    ticketCodigoUuid: "aaaaaaa1-1111-4111-8111-111111111111",
    ticketEstado: "EMITIDO",
    creadoEn: new Date(),
  });

  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-5" } };

  const res = await registerRoute.POST(
    new Request(`http://localhost:3000/api/tournaments/${TORNEO_PAGO_ID}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagoId: pagoDuplicadoId,
      }),
    }),
    { params: Promise.resolve({ id: TORNEO_PAGO_ID }) },
  );

  assert.ok([400, 409].includes(res.status));
  const data = await res.json();
  assert.ok(["PAYMENT_INVALID", "PAYMENT_ALREADY_USED"].includes(data.error.code));
});

test("API: GET /api/tournaments retorna miInscripcion con ticketCodigoUuid y ticketQrPayload firmado SC1 (INT-01)", async () => {
  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-5" } };
  const req = new Request("http://localhost:3000/api/tournaments");
  const res = await listRoute.GET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.success, true);

  const abierto = body.data.find((t: any) => t.id === TORNEO_ABIERTO_ID);
  assert.ok(abierto);
  assert.equal(abierto.yaInscrito, true);
  assert.ok(abierto.miInscripcion);
  assert.equal(abierto.miInscripcion.ticketCodigoUuid, "aaaaaaa1-1111-4111-8111-111111111111");
  assert.equal(abierto.miInscripcion.estado, "CONFIRMADA");

  // INT-01: Validar que el servidor entrega ticketQrPayload firmado con el estándar SC1:<uuid>:<hmac>
  assert.ok(abierto.miInscripcion.ticketQrPayload, "Debe incluir ticketQrPayload para inscripción confirmada");
  assert.match(
    abierto.miInscripcion.ticketQrPayload,
    /^SC1:aaaaaaa1-1111-4111-8111-111111111111:[a-f0-9]{64}$/,
    "El payload del QR debe cumplir el formato estandarizado SC1:<uuid>:<hmac-sha256>",
  );

  const parsed = parseTicketQrPayload(abierto.miInscripcion.ticketQrPayload);
  assert.ok(parsed, "parseTicketQrPayload debe parsear exitosamente el payload");
  assert.equal(parsed.ticketId, "aaaaaaa1-1111-4111-8111-111111111111");
  assert.equal(
    verifyTicketSignature(parsed.ticketId, parsed.signature, process.env.QR_HMAC_SECRET!),
    true,
    "La firma HMAC-SHA256 del ticketQrPayload debe ser criptográficamente válida con QR_HMAC_SECRET",
  );
});

test("API: GET /api/tournaments no entrega ticketQrPayload firmado si la inscripción está en PENDIENTE_PAGO (BUS-01)", async () => {
  mock._state.inscripcionesTorneo.push({
    id: "inscripcion-pendiente-sin-qr",
    torneoId: TORNEO_PAGO_ID,
    usuarioId: "user-cliente-5",
    nombrePareja: null,
    pagoId: null,
    estado: "PENDIENTE_PAGO",
    ticketCodigoUuid: null,
    ticketEstado: "PENDIENTE",
    creadoEn: new Date(),
  });

  (globalThis as any).__scAuthSession = { user: { id: "user-cliente-5" } };
  const req = new Request("http://localhost:3000/api/tournaments");
  const res = await listRoute.GET(req);
  assert.equal(res.status, 200);

  const body = await res.json();
  const torneoPago = body.data.find((t: any) => t.id === TORNEO_PAGO_ID);
  assert.ok(torneoPago);
  assert.equal(torneoPago.yaInscrito, true);
  assert.ok(torneoPago.miInscripcion);
  assert.equal(torneoPago.miInscripcion.estado, "PENDIENTE_PAGO");
  assert.equal(
    torneoPago.miInscripcion.ticketQrPayload,
    null,
    "Inscripción PENDIENTE_PAGO no debe recibir ticketQrPayload firmado",
  );
});



