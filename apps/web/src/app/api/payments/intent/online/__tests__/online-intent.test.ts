import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { createMockPrisma } from "../../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const STRIPE_SECRET_KEY = "sk_test_online_key_secret_dummy";
process.env.STRIPE_SECRET_KEY = STRIPE_SECRET_KEY;

const mock = createMockPrisma();
(globalThis as typeof globalThis & { __scPrisma: unknown }).__scPrisma = mock;

const onlineRoute = await import("../route");

const titularId = "cliente-online-1";
const anotherUserId = "cliente-online-2";
const reservationId = "11111111-2222-4333-8444-555555555555";
const expiredReservationId = "22222222-3333-4444-8555-666666666666";
const nonOnlineReservationId = "33333333-4444-4555-8666-777777777777";
const nonPendingReservationId = "44444444-5555-4666-8777-888888888888";

function seedUser(id: string) {
  if (!mock._state.usuarios.some((u: { id: string }) => u.id === id)) {
    mock._state.usuarios.push({
      id,
      nombre: `User ${id}`,
      estado: "ACTIVO",
      deletedAt: null,
      rolNombre: "CLIENTE",
    });
  }
}

seedUser(titularId);
seedUser(anotherUserId);

function setSession(userId: string | null) {
  (globalThis as typeof globalThis & { __scAuthSession: unknown }).__scAuthSession = userId
    ? { user: { id: userId, email: `${userId}@sportcomplex.test` } }
    : null;
}

function createRequest(body: unknown) {
  return new Request("http://localhost:3000/api/payments/intent/online", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST /api/payments/intent/online: 401 si no hay usuario autenticado", async () => {
  setSession(null);
  const res = await onlineRoute.POST(createRequest({ reservationId }));
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHORIZED");
});

test("POST /api/payments/intent/online: 404 si la reserva no existe (no crea PaymentIntent)", async () => {
  setSession(titularId);
  const nonExistentId = "99999999-9999-4999-8999-999999999999";
  const res = await onlineRoute.POST(createRequest({ reservationId: nonExistentId }));
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, "RESERVATION_NOT_FOUND");
});

test("POST /api/payments/intent/online: 404 si la reserva pertenece a otro usuario", async () => {
  // Creamos reserva asignada a anotherUserId
  mock._state.reservas.push({
    id: "88888888-8888-4888-8888-888888888888",
    disponibilidadId: 1n,
    titularId: anotherUserId,
    estado: "PENDIENTE_PAGO",
    canal: "ONLINE",
    total: 50000,
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
  });

  setSession(titularId); // intentamos pagar con titularId
  const res = await onlineRoute.POST(createRequest({ reservationId: "88888888-8888-4888-8888-888888888888" }));
  assert.equal(res.status, 404);
  const data = await res.json();
  assert.equal(data.error.code, "RESERVATION_NOT_FOUND");
});

test("POST /api/payments/intent/online: 409 si la reserva ya venció (expirada)", async () => {
  mock._state.reservas.push({
    id: expiredReservationId,
    disponibilidadId: 1n,
    titularId,
    estado: "PENDIENTE_PAGO",
    canal: "ONLINE",
    total: 50000,
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() - 60_000), // En el pasado
    pagoId: null,
  });

  setSession(titularId);
  const res = await onlineRoute.POST(createRequest({ reservationId: expiredReservationId }));
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "RESERVATION_NOT_PAYABLE");
});

test("POST /api/payments/intent/online: 409 si la reserva no es canal ONLINE", async () => {
  mock._state.reservas.push({
    id: nonOnlineReservationId,
    disponibilidadId: 1n,
    titularId,
    estado: "PENDIENTE_PAGO",
    canal: "TAQUILLA",
    total: 50000,
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
  });

  setSession(titularId);
  const res = await onlineRoute.POST(createRequest({ reservationId: nonOnlineReservationId }));
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "RESERVATION_NOT_PAYABLE");
});

test("POST /api/payments/intent/online: 409 si la reserva no está en estado PENDIENTE_PAGO", async () => {
  mock._state.reservas.push({
    id: nonPendingReservationId,
    disponibilidadId: 1n,
    titularId,
    estado: "CONFIRMADA",
    canal: "ONLINE",
    total: 50000,
    cantidadCupos: 1,
    expiraEn: new Date(Date.now() + 15 * 60_000),
    pagoId: null,
  });

  setSession(titularId);
  const res = await onlineRoute.POST(createRequest({ reservationId: nonPendingReservationId }));
  assert.equal(res.status, 409);
  const data = await res.json();
  assert.equal(data.error.code, "RESERVATION_NOT_PAYABLE");
});

test("POST /api/payments/intent/online: 200 con reserva válida usa monto real y asocia paymentIntent", async () => {
  mock._state.reservas.push({
    id: reservationId,
    disponibilidadId: 1n,
    titularId,
    estado: "PENDIENTE_PAGO",
    canal: "ONLINE",
    total: 75000,
    cantidadCupos: 2,
    expiraEn: new Date(Date.now() + 20 * 60_000),
    pagoId: null,
  });

  let capturedStripePayload: Stripe.PaymentIntentCreateParams | null = null;
  const mockStripe = {
    paymentIntents: {
      create: async (params: Stripe.PaymentIntentCreateParams) => {
        capturedStripePayload = params;
        return {
          id: "pi_online_test_123",
          client_secret: "pi_online_test_123_secret_xyz",
          amount: params.amount,
          currency: params.currency,
          status: "requires_payment_method",
        };
      },
    },
  };

  setSession(titularId);
  const res = await onlineRoute.POST(createRequest({ reservationId }), {
    stripeClient: mockStripe as unknown as Stripe,
  });
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.success, true);
  assert.equal(data.data.clientSecret, "pi_online_test_123_secret_xyz");
  assert.equal(data.data.paymentIntentId, "pi_online_test_123");

  assert.ok(capturedStripePayload);
  const payload = capturedStripePayload as Stripe.PaymentIntentCreateParams;
  assert.equal(payload.amount, 7_500_000);
  assert.equal(payload.currency, "cop");
  assert.equal(payload.metadata?.bookingId, reservationId);
  assert.equal(payload.metadata?.userId, titularId);
});
