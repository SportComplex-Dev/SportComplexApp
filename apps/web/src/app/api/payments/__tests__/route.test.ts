/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = "sk_test_dummy_key";
const STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET;

const { createMockPrisma } = await import(
  "../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

// Import route handler DESPUÉS de inyectar el mock de Prisma.
const paymentsRoute = await import("../route");

const stripe = new Stripe(STRIPE_SECRET_KEY);

function seedReserva() {
  mock._state.reservas.push({
    id: "reserva-1",
    disponibilidadId: 1n,
    estado: "PENDIENTE_PAGO",
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
  });
}

function buildEventPayload(
  overrides: {
    id?: string;
    type?: string;
    object?: Record<string, unknown>;
  } = {},
) {
  const event = {
    id: overrides.id ?? "evt_tsk_bd_09_1",
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: overrides.type ?? "payment_intent.succeeded",
    data: {
      object: {
        id: "pi_tsk_bd_09_1",
        object: "payment_intent",
        amount: 7500000,
        currency: "cop",
        status: "succeeded",
        metadata: {
          bookingId: "reserva-1",
          userId: "user-1",
          cashless: "true",
        },
        ...(overrides.object ?? {}),
      },
    },
  };
  return JSON.stringify(event);
}

function signPayload(payload: string) {
  return stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });
}

function postWebhook(payload: string, signature?: string) {
  const headers: Record<string, string> = {};
  if (signature !== undefined) headers["stripe-signature"] = signature;
  return paymentsRoute.POST(
    new Request("http://localhost:3000/api/payments", {
      method: "POST",
      headers,
      body: payload,
    }),
  );
}

test("TSK-BD-09 API: reenviar el mismo webhook dos veces → 200, 1 PAGO y 1 reserva CONFIRMADA", async () => {
  seedReserva();
  const payload = buildEventPayload();
  const signature = signPayload(payload);

  const primera = await postWebhook(payload, signature);
  assert.equal(primera.status, 200);
  const body1 = await primera.json();
  assert.equal(body1.success, true);
  assert.equal(body1.data.pagoCreado, true);
  assert.equal(body1.data.reservaConfirmada, true);
  assert.equal(body1.data.estado, "APROBADO");

  // Stripe reintenta el mismo evento byte a byte.
  const segunda = await postWebhook(payload, signature);
  assert.equal(segunda.status, 200);
  const body2 = await segunda.json();
  assert.equal(body2.success, true);
  assert.equal(body2.data.duplicado, true);
  assert.equal(body2.data.pagoCreado, false);
  assert.equal(body2.data.reservaConfirmada, false);

  // CRITERIO DE ACEPTACIÓN: una sola fila en PAGO y una sola CONFIRMADA.
  assert.equal(mock._state.pagos.length, 1);
  assert.equal(mock._state.pagos[0].monto, "75000.00");
  const confirmadas = mock._state.reservas.filter((r: any) => r.estado === "CONFIRMADA");
  assert.equal(confirmadas.length, 1);
});

test("TSK-BD-09 API: rechaza firma inválida o ausente (400) sin tocar la BD", async () => {
  const payload = buildEventPayload({ id: "evt_2" });

  const sinFirma = await postWebhook(payload);
  assert.equal(sinFirma.status, 400);
  assert.equal((await sinFirma.json()).error.code, "MISSING_SIGNATURE");

  const firmaMala = await postWebhook(payload, "t=1,v1=deadbeef");
  assert.equal(firmaMala.status, 400);
  assert.equal((await firmaMala.json()).error.code, "INVALID_SIGNATURE");

  assert.equal(mock._state.pagos.length, 1); // nada nuevo
});

test("TSK-BD-09 API: eventos no manejados o sin metadatos nuestros se ignoran con 200", async () => {
  const otroEvento = JSON.stringify({
    id: "evt_3",
    object: "event",
    type: "charge.refunded",
    data: { object: { id: "ch_1" } },
  });
  const resOtro = await postWebhook(otroEvento, signPayload(otroEvento));
  assert.equal(resOtro.status, 200);
  assert.equal((await resOtro.json()).data.ignored, true);

  const sinMetadatos = buildEventPayload({
    id: "evt_4",
    object: { id: "pi_sin_metadata", metadata: {} },
  });
  const resSin = await postWebhook(sinMetadatos, signPayload(sinMetadatos));
  assert.equal(resSin.status, 200);
  const bodySin = await resSin.json();
  assert.equal(bodySin.data.ignored, true);
  assert.equal(bodySin.data.reason, "MISSING_METADATA");

  assert.equal(mock._state.pagos.length, 1); // sigue sin duplicarse nada
});

test("TSK-BD-09 API: 503 si faltan las variables de entorno de Stripe", async () => {
  const prevKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  try {
    const res = await postWebhook(buildEventPayload({ id: "evt_5" }), "t=1,v1=x");
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "STRIPE_NOT_CONFIGURED");
  } finally {
    process.env.STRIPE_SECRET_KEY = prevKey;
  }
});

test("TSK-BE-10 API: pago fallido cancela la reserva y restituye la franja", async () => {
  mock._state.reservas.push({
    id: "reserva-fail",
    disponibilidadId: 9n,
    estado: "PENDIENTE_PAGO",
    cantidadCupos: 2,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
  });
  mock._state.disponibilidades.push({
    id: 9n,
    servicioId: 1,
    franjaId: 1,
    fecha: new Date(),
    cuposTotales: 5,
    cuposOcupados: 2,
    bloqueadaMantenimiento: false,
  });

  const payload = buildEventPayload({
    id: "evt_fail_1",
    type: "payment_intent.payment_failed",
    object: {
      id: "pi_fail_1",
      metadata: { bookingId: "reserva-fail", userId: "user-1" },
    },
  });
  const res = await postWebhook(payload, signPayload(payload));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.estado, "FALLIDO");
  assert.equal(body.data.reservaEstado, "CANCELADA_PAGO");
  assert.equal(body.data.franjaRestituida, true);

  const reserva = mock._state.reservas.find((r: any) => r.id === "reserva-fail");
  assert.equal(reserva.estado, "CANCELADA_PAGO");
  const disp = mock._state.disponibilidades.find((d: any) => d.id === 9n);
  assert.equal(disp.cuposOcupados, 0);
});

test("TSK-BE-10 API: /api/webhooks/stripe expone el mismo handler POST", async () => {
  const alias = await import("../../webhooks/stripe/route");
  assert.equal(typeof alias.POST, "function");
});
