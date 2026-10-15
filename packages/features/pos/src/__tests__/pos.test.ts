/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const { createMockPrisma } = await import("@db-test/mock-prisma");
const mock = createMockPrisma();
Reflect.set(process.env, "NODE_ENV", "test");
(globalThis as any).__scPrisma = mock;

const { createPosCheckoutPostHandler } = await import("../services/posCheckout");

const VENDEDOR_ID = "00000000-0000-4000-8000-000000000020";
const CLIENTE_ID = "00000000-0000-4000-8000-000000000001";

// Handler con inyección controlada de Stripe para test
const mockCreatePaymentIntent = async (input: any) => ({
  paymentIntentId: `pi_test_${Date.now()}`,
  clientSecret: `pi_test_${Date.now()}_secret_test`,
  amount: input.total * 100,
  currency: "cop",
  status: "requires_payment_method",
});

const POST = createPosCheckoutPostHandler({
  createPaymentIntent: mockCreatePaymentIntent as any,
});

function resetDb() {
  for (const key of [
    "usuarios",
    "servicios",
    "franjas",
    "disponibilidades",
    "reservas",
    "tickets",
    "pagos",
    "membresias",
  ] as const) {
    mock._state[key].length = 0;
  }

  mock._state.usuarios.push(
    { id: VENDEDOR_ID, nombre: "Vendedor Taquilla", correo: "vendedor@akros.test", estado: "ACTIVO", rolId: 2, rolNombre: "Empleado_Vendedor" },
    { id: CLIENTE_ID, nombre: "Cliente Mostrador", correo: "cliente@akros.test", estado: "ACTIVO", rolId: 1, rolNombre: "CLIENTE" },
  );

  mock._state.servicios.push({
    id: 10,
    categoriaId: 1,
    nombre: "Cancha Pádel 1",
    capacidadMaxima: 4,
    tarifa: 80000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  });
}

test("POS API: 401 si no hay sesión autenticada", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = null;

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 401);
});

test("POS API: 403 si el rol autenticado es Cliente (exclusivo para Taquilla)", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: CLIENTE_ID, email: "cliente@akros.test", role: "Cliente" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 403);
});

test("POS API (RN-13 / RF-17): 400 si se intenta pagar en efectivo (cero efectivo)", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
      paymentMode: "cash", // Prohibido
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("POS API (SEC-03 / RN-08): cliente sin membresía VIGENTE no recibe descuento del 30% aunque envíe esSocio: true", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos NoSocio",
      clienteDocumento: "1020304050",
      clienteEmail: "nosocio@akros.test",
      esSocio: true, // Intento de fraude en cliente
      paymentMode: "stripe_card",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  // Al no tener membresía VIGENTE en la BD, la tarifa se cobra completa (80000)
  assert.equal(json.data.booking.amount, 80000);
  assert.equal(json.data.booking.discount, 0);
});

test("POS API (SEC-03 / RN-08): cliente CON membresía VIGENTE sí recibe descuento automático del 30%", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  // Registrar membresía VIGENTE en la BD para el cliente
  mock._state.membresias.push({
    id: 99,
    usuarioId: CLIENTE_ID,
    planId: 1,
    estado: "VIGENTE",
    fechaInicio: new Date(),
    proximaRenovacion: new Date(Date.now() + 30 * 86400000),
  });

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Cliente Mostrador",
      clienteDocumento: "1020304050",
      clienteEmail: "cliente@akros.test",
      esSocio: true,
      paymentMode: "stripe_card",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  // Tarifa 80000 con 30% descuento = 56000
  assert.equal(json.data.booking.amount, 56000);
  assert.equal(json.data.booking.discount, 24000);
});

test("POS API (PERF-01): 409 CAPACITY_EXCEEDED si los cupos solicitados superan el límite", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  mock._state.disponibilidades.push({
    id: 101n,
    servicioId: 10,
    franjaId: 1,
    fecha: new Date("2026-10-15T00:00:00.000Z"),
    cuposTotales: 2,
    cuposOcupados: 2, // Ya lleno
    bloqueadaMantenimiento: false,
  });

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      disponibilidadId: "101",
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_card",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.error.code, "CAPACITY_EXCEEDED");
});

test("POS API (PERF-01): 409 SLOT_BLOCKED si la franja está bloqueada por mantenimiento", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  mock._state.disponibilidades.push({
    id: 102n,
    servicioId: 10,
    franjaId: 1,
    fecha: new Date("2026-10-15T00:00:00.000Z"),
    cuposTotales: 4,
    cuposOcupados: 0,
    bloqueadaMantenimiento: true, // En mantenimiento
  });

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      disponibilidadId: "102",
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_card",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.error.code, "SLOT_BLOCKED");
});

test("POS API (SEC-02 / ARCH-01): venta presencial emite PaymentIntent y crea reserva PENDIENTE_PAGO", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      clienteTelefono: "3001234567",
      paymentMode: "stripe_card",
      cardLast4: "4242",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.booking.status, "PENDIENTE_PAGO");
  assert.equal(json.data.booking.canal, "TAQUILLA");
  assert.equal(json.data.booking.vendedorId, VENDEDOR_ID);
  assert.equal(json.data.booking.amount, 80000);
  assert.ok(json.data.paymentIntent.clientSecret);
  assert.ok(json.data.paymentIntent.id.startsWith("pi_test_"));
});

test("POS API (SRS §11.1 Riesgo 2 / ARCH-03): genera enlace de pago alternativo compatible con /checkout", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_link",
    }),
  });

  const prevStripeKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.booking.paymentMode, "stripe_link");
    assert.ok(json.data.booking.alternativePaymentUrl.includes("checkout?session_id="));
    assert.ok(json.data.booking.alternativePaymentUrl.includes("serviceId=10"));
    assert.ok(json.data.booking.alternativePaymentUrl.includes("amount=80000"));
  } finally {
    if (prevStripeKey !== undefined) process.env.STRIPE_SECRET_KEY = prevStripeKey;
  }
});

test("POS API (ARCH-03): genera sesión real de Stripe Checkout cuando createCheckoutSession está inyectado", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const handlerConStripe = createPosCheckoutPostHandler({
    createPaymentIntent: mockCreatePaymentIntent as any,
    createCheckoutSession: (async () => ({
      sessionId: "cs_test_pos_alt_999",
      url: "https://checkout.stripe.com/c/pay/cs_test_pos_alt_999",
      paymentIntentId: null,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    })) as any,
  });

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_link",
    }),
  });

  const res = await handlerConStripe(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.booking.paymentMode, "stripe_link");
  assert.equal(json.data.booking.stripeCheckoutSessionId, "cs_test_pos_alt_999");
  assert.equal(json.data.alternativePaymentUrl, "https://checkout.stripe.com/c/pay/cs_test_pos_alt_999");
});

test("POS API (ARCH-02): rechaza el código QR apócrifo SC1:AKR-POS-XXXX:AKROS_POS_VERIFIED y valida el QR oficial firmado por el servidor", async () => {
  const { parseTicketQrPayload, verifyTicketSignature, buildTicketQrPayload, signTicket } = await import("@sportcomplex/core");

  // 1. Verificar que el formato apócrifo anterior es rechazado rotundamente por el lector de torniquetes
  const fakePayload = "SC1:AKR-POS-1234:AKROS_POS_VERIFIED";
  const fakeParsed = parseTicketQrPayload(fakePayload);
  assert.equal(fakeParsed, null, "El lector de torniquetes debe rechazar el QR apócrifo sin UUID ni firma HMAC");

  // 2. Verificar que el QR oficial con UUID y firma HMAC-SHA256 supera parseTicketQrPayload y verifyTicketSignature
  const secret = "secreto-seguro-hmac-test";
  const validTicketUuid = "00000000-0000-4000-8000-000000000099";
  const signature = signTicket(validTicketUuid, secret);
  const officialPayload = buildTicketQrPayload(validTicketUuid, signature);

  const officialParsed = parseTicketQrPayload(officialPayload);
  assert.ok(officialParsed);
  assert.equal(officialParsed.ticketId, validTicketUuid);
  assert.equal(officialParsed.signature, signature);
  assert.equal(verifyTicketSignature(officialParsed.ticketId, officialParsed.signature, secret), true);
});
