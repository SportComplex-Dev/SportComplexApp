/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = "sk_test_dummy_key";
const STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
const N8N_URL = "https://n8n.example.com/webhook/reservas/despacho-qr";

process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;
process.env.N8N_RESERVATION_QR_WEBHOOK_URL = N8N_URL;
process.env.NEXT_PUBLIC_APP_URL = "https://akros.lat";

const { createMockPrisma } = await import("@db-test/mock-prisma");
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

// Import route handler DESPUÉS de inyectar el mock de Prisma.
const stripeWebhookRoute = await import("@/app/api/webhooks/stripe/route");
const paymentsRoute = await import("@/app/api/payments/route");
const { parseTicketQrPayload, verifyTicketSignature } = await import("@sportcomplex/security");

const stripe = new Stripe(STRIPE_SECRET_KEY);

function seedTestData(overrides: Record<string, unknown> = {}) {
  const userId = (overrides.userId as string) ?? "user-stripe-1";
  const reservaId = (overrides.reservaId as string) ?? "reserva-stripe-1";

  // Usuario titular
  mock._state.usuarios.push({
    id: userId,
    nombre: "Juan Esteban Bolívar",
    correo: "jebolivar33@gmail.com",
    rolId: 1,
    creadoEn: new Date(),
  });

  // Categoría y Servicio
  mock._state.categorias.push({ id: 1, nombre: "Tenis" });
  mock._state.servicios.push({
    id: 1,
    nombre: "Cancha de Tenis 1",
    modalidad: "CANCHA",
    tarifa: 75000,
    categoriaId: 1,
    duracionMinutos: 60,
    capacidadMaxima: 4,
    activo: true,
  });

  // Franja Horaria (10:00 - 11:00)
  mock._state.franjas.push({
    id: 1,
    horaInicio: new Date("1970-01-01T10:00:00.000Z"),
    horaFin: new Date("1970-01-01T11:00:00.000Z"),
  });

  // Disponibilidad
  mock._state.disponibilidades.push({
    id: 100n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date("2026-10-25T00:00:00.000Z"),
    cuposTotales: 4,
    cuposOcupados: 1,
    bloqueadaMantenimiento: false,
  });

  // Reserva PENDIENTE_PAGO
  const reserva = {
    id: reservaId,
    disponibilidadId: 100n,
    titularId: userId,
    estado: "PENDIENTE_PAGO",
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
    total: 75000,
    subtotal: 75000,
    descuentoPct: 0,
    creadoEn: new Date(),
    ...overrides,
  };
  mock._state.reservas.push(reserva);
  return { reserva, userId, reservaId };
}

function buildEventPayload(overrides: {
  id?: string;
  type?: string;
  bookingId?: string;
  userId?: string;
} = {}) {
  const eventId = overrides.id ?? "evt_stripe_qr_1";
  const event = {
    id: eventId,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: overrides.type ?? "payment_intent.succeeded",
    data: {
      object: {
        id: `pi_${eventId}`,
        object: "payment_intent",
        amount: 7500000,
        currency: "cop",
        status: "succeeded",
        metadata: {
          bookingId: overrides.bookingId ?? "reserva-stripe-1",
          userId: overrides.userId ?? "user-stripe-1",
          cashless: "true",
        },
      },
    },
  };
  return JSON.stringify(event);
}

function buildCheckoutSessionPayload(input: {
  id: string;
  paymentIntentId: string;
  reservaId: string;
  userId: string;
  amountTotal?: number;
}) {
  return JSON.stringify({
    id: `evt_${input.id}`,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    data: {
      object: {
        id: input.id,
        object: "checkout.session",
        payment_intent: input.paymentIntentId,
        payment_status: "paid",
        amount_total: input.amountTotal ?? 7500000,
        currency: "cop",
        metadata: { bookingId: input.reservaId, userId: input.userId },
      },
    },
  });
}

function signPayload(payload: string) {
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });
}

function postStripeWebhook(payload: string, signature?: string) {
  const headers: Record<string, string> = {};
  if (signature !== undefined) headers["stripe-signature"] = signature;
  return stripeWebhookRoute.POST(
    new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers,
      body: payload,
    }),
  );
}

test("TSK-BE-34 / SCRUM-239: alias de stripe reexporta POST canónico", () => {
  assert.equal(stripeWebhookRoute.POST, paymentsRoute.POST);
});

test("TSK-BE-31: checkout.session.completed confirma reserva y emite un ticket", async () => {
  const { reservaId, userId } = seedTestData({
    reservaId: "res-checkout-session-be31",
    userId: "usr-checkout-session-be31",
  });
  const payload = buildCheckoutSessionPayload({
    id: "cs_checkout_session_be31",
    paymentIntentId: "pi_checkout_session_be31",
    reservaId,
    userId,
  });
  const signature = signPayload(payload);
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

  try {
    const response = await postStripeWebhook(payload, signature);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.reservaConfirmada, true);
    assert.equal(body.data.ticketQrEmitido, true);
    assert.equal(mock._state.reservas.find((r: any) => r.id === reservaId)?.estado, "CONFIRMADA");
    assert.equal(mock._state.tickets.filter((t: any) => t.reservaId === reservaId).length, 1);
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("TSK-BE-31: checkout multi-hora envía un único QR firmado para toda la ventana", async () => {
  const userId = "usr-be31-multislot";
  const firstId = "res-be31-multislot-1";
  const secondId = "res-be31-multislot-2";
  const { reserva: first, userId: seededUserId } = seedTestData({ reservaId: firstId, userId });
  const date = new Date("2026-10-25T00:00:00.000Z");
  const firstAvailabilityId = 901n;
  const secondAvailabilityId = 902n;
  first.disponibilidadId = firstAvailabilityId;
  first.total = 75000;
  mock._state.franjas.push(
    { id: 901, servicioId: 1, diaSemana: 7, horaInicio: new Date("1970-01-01T14:00:00.000Z"), horaFin: new Date("1970-01-01T15:00:00.000Z") },
    { id: 902, servicioId: 1, diaSemana: 7, horaInicio: new Date("1970-01-01T15:00:00.000Z"), horaFin: new Date("1970-01-01T16:00:00.000Z") },
  );
  mock._state.disponibilidades.push(
    { id: firstAvailabilityId, servicioId: 1, franjaId: 901, fecha: date, cuposTotales: 4, cuposOcupados: 1, bloqueadaMantenimiento: false },
    { id: secondAvailabilityId, servicioId: 1, franjaId: 902, fecha: date, cuposTotales: 4, cuposOcupados: 1, bloqueadaMantenimiento: false },
  );
  mock._state.reservas.push({
    id: secondId,
    disponibilidadId: secondAvailabilityId,
    titularId: seededUserId,
    estado: "PENDIENTE_PAGO",
    cantidadCupos: 1,
    total: 75000,
    subtotal: 75000,
    descuentoPct: 0,
    pagoId: null,
  });

  const previousQrSecret = process.env.QR_HMAC_SECRET;
  process.env.QR_HMAC_SECRET = "qr-hmac-secret-be31-test";
  const payload = buildCheckoutSessionPayload({
    id: "cs_checkout_be31_multislot",
    paymentIntentId: "pi_checkout_be31_multislot",
    reservaId: `${firstId},${secondId}`,
    userId,
    amountTotal: 15000000,
  });
  const previousFetch = globalThis.fetch;
  const dispatched: any[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("reservas/despacho-qr")) {
      dispatched.push(JSON.parse(String(init?.body)));
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const response = await postStripeWebhook(payload, signPayload(payload));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.reservaConfirmada, true);
    assert.deepEqual(body.data.reservasConfirmadas, [firstId, secondId]);
    assert.equal(mock._state.reservas.find((r: any) => r.id === firstId)?.estado, "CONFIRMADA");
    assert.equal(mock._state.reservas.find((r: any) => r.id === secondId)?.estado, "CONFIRMADA");

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(mock._state.tickets.filter((ticket: any) => ticket.reservaId === firstId || ticket.reservaId === secondId).length, 1);
    assert.equal(dispatched.length, 1);
    assert.equal(dispatched[0]?.franjaHoraria, "14:00 - 16:00");
    const qr = parseTicketQrPayload(dispatched[0]?.qrPayload);
    assert.ok(qr);
    assert.equal(verifyTicketSignature(qr.ticketId, qr.signature, process.env.QR_HMAC_SECRET!, {
      start: new Date("2026-10-25T19:00:00.000Z"),
      end: new Date("2026-10-25T21:00:00.000Z"),
    }), true);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousQrSecret === undefined) delete process.env.QR_HMAC_SECRET;
    else process.env.QR_HMAC_SECRET = previousQrSecret;
  }
});

test("TSK-BE-34 / SCRUM-239: webhook responde HTTP 200 en < 2 segundos y despacha correo con payload de boleto y QR", async () => {
  const { reservaId, userId } = seedTestData({
    reservaId: "res-email-test-1",
    userId: "usr-email-test-1",
  });

  const payload = buildEventPayload({
    id: "evt_email_1",
    bookingId: reservaId,
    userId,
  });
  const signature = signPayload(payload);

  const prevFetch = globalThis.fetch;
  let n8nDispatched = false;
  let n8nPayloadCaptured: any = null;

  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("reservas/despacho-qr")) {
      n8nDispatched = true;
      n8nPayloadCaptured = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true, mensaje: "despachado" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(null, { status: 200 });
  };

  try {
    const start = Date.now();
    const response = await postStripeWebhook(payload, signature);
    const duration = Date.now() - start;

    // Criterio de aceptación 1: responde HTTP 200 en menos de 2 segundos (< 2000 ms)
    assert.equal(response.status, 200);
    assert.ok(duration < 2000, `El webhook tardó ${duration}ms, debe ser < 2000ms`);

    const json = await response.json();
    assert.equal(json.success, true);
    assert.equal(json.data.reservaConfirmada, true);
    assert.equal(json.data.estado, "APROBADO");

    // Damos tiempo a la micro-tarea asíncrona de resolución de promesa fire-and-forget
    await new Promise((r) => setTimeout(r, 50));

    // Criterio de aceptación 2: correo despachado a n8n con payload completo
    assert.equal(n8nDispatched, true, "El webhook de n8n debió ser invocado");
    assert.ok(n8nPayloadCaptured, "El payload despachado a n8n no debe ser nulo");
    assert.equal(n8nPayloadCaptured.reservaId, reservaId);
    assert.equal(n8nPayloadCaptured.correo, "jebolivar33@gmail.com");
    assert.equal(n8nPayloadCaptured.nombre, "Juan Esteban Bolívar");
    assert.equal(n8nPayloadCaptured.cancha, "Cancha de Tenis 1");
    assert.ok(n8nPayloadCaptured.qrPayload, "Debe incluir el qrPayload");
    assert.ok(n8nPayloadCaptured.qrImageUrl, "Debe incluir la URL de la imagen QR");
    assert.ok(n8nPayloadCaptured.qrImageUrl.includes(encodeURIComponent(n8nPayloadCaptured.qrPayload)));
    assert.ok(n8nPayloadCaptured.html, "Debe incluir el HTML transaccional renderizado (TSK-FE-37)");
    assert.ok(n8nPayloadCaptured.html.includes("<!DOCTYPE html>"), "Debe contener DOCTYPE HTML");
    assert.ok(n8nPayloadCaptured.html.includes("AKROS Active Lifestyle Club"), "Debe reflejar la identidad AKROS");
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("TSK-BE-34 / SCRUM-239: resiliencia — falla en n8n no revierte reserva ni bloquea respuesta 200 a Stripe", async () => {
  const { reservaId, userId } = seedTestData({
    reservaId: "res-resilience-1",
    userId: "usr-resilience-1",
  });

  const payload = buildEventPayload({
    id: "evt_resilience_1",
    bookingId: reservaId,
    userId,
  });
  const signature = signPayload(payload);

  const prevFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("n8n offline or network timeout");
  };

  try {
    const response = await postStripeWebhook(payload, signature);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.reservaConfirmada, true);

    // La reserva en base de datos quedó en CONFIRMADA (no se revirtió)
    const reservaEnDb = mock._state.reservas.find((r: any) => r.id === reservaId);
    assert.equal(reservaEnDb.estado, "CONFIRMADA");
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test("TSK-BE-34 / SCRUM-239: idempotencia — reintento duplicado de Stripe no re-dispara el correo", async () => {
  const { reservaId, userId } = seedTestData({
    reservaId: "res-idempotence-1",
    userId: "usr-idempotence-1",
  });

  const payload = buildEventPayload({
    id: "evt_idempotence_1",
    bookingId: reservaId,
    userId,
  });
  const signature = signPayload(payload);

  const prevFetch = globalThis.fetch;
  let dispatchCount = 0;

  globalThis.fetch = async (input) => {
    if (String(input).includes("reservas/despacho-qr")) {
      dispatchCount++;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    // Primer despacho exitoso
    const res1 = await postStripeWebhook(payload, signature);
    assert.equal(res1.status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(dispatchCount, 1);

    // Segundo despacho: Stripe reintenta el mismo evento
    const res2 = await postStripeWebhook(payload, signature);
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.data.duplicado, true);

    await new Promise((r) => setTimeout(r, 50));
    // El contador NO debe incrementar
    assert.equal(dispatchCount, 1, "No debe re-despachar el correo en webhooks duplicados");
  } finally {
    globalThis.fetch = prevFetch;
  }
});
