import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const mock = createMockPrisma();
(globalThis as typeof globalThis & { __scPrisma: unknown }).__scPrisma = mock;

const { authorizeApiRequest } = await import("@/lib/api-auth");
const { createPaymentIntentPostHandler } = await import("../route");
const reservaId = "c8a2a831-5d31-4bb2-a169-1e2d1bb8261a";
const vendedorId = "vendedor-pos-test";

function reservation(overrides: Record<string, unknown> = {}) {
  return {
    id: reservaId,
    titularId: "cliente-pos-test",
    vendedorId: null,
    pagoId: null,
    estado: "PENDIENTE_PAGO",
    total: 75000,
    expiraEn: new Date(Date.now() + 60_000),
    disponibilidad: { servicioId: 7, servicio: { estado: "ACTIVO" } },
    ...overrides,
  };
}

function request(body: unknown = { reservaId }) {
  return new Request("http://localhost:3000/api/payments/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function handler(options: {
  authorize?: typeof authorizeApiRequest;
  reserva?: ReturnType<typeof reservation> | null;
  createPaymentIntent?: () => Promise<{
    paymentIntentId: string;
    clientSecret: string;
    amount: number;
    currency: string;
    status: string;
  }>;
} = {}) {
  return createPaymentIntentPostHandler({
    authorize: options.authorize ?? (async () => ({
      authorized: true,
      actor: { id: vendedorId, role: "Empleado_Vendedor" },
    })) as typeof authorizeApiRequest,
    findReserva: async () => options.reserva === undefined ? reservation() : options.reserva,
    createPaymentIntent: options.createPaymentIntent ?? (async () => ({
      paymentIntentId: "pi_pos_test",
      clientSecret: "pi_pos_test_secret_test",
      amount: 7_500_000,
      currency: "cop",
      status: "requires_payment_method",
    })) as typeof import("@sportcomplex/core").createPosPaymentIntent,
  });
}

test("TSK-BE-18 POST /api/payments/intent: devuelve 401 sin sesión", async () => {
  (globalThis as typeof globalThis & { __scAuthSession: null }).__scAuthSession = null;
  const response = await createPaymentIntentPostHandler({
    authorize: authorizeApiRequest,
    findReserva: async () => reservation() as never,
  })(request());

  assert.equal(response.status, 401);
  assert.equal((await response.json()).error.code, "UNAUTHORIZED");
});

test("TSK-BE-18 POST /api/payments/intent: deniega rol sin permisos con 403", async () => {
  (globalThis as typeof globalThis & { __scAuthSession: { user: { id: string } } }).__scAuthSession = {
    user: { id: "cliente-test" },
  };
  mock._state.usuarios.push({
    id: "cliente-test", nombre: "Cliente", estado: "ACTIVO", deletedAt: null, rolNombre: "CLIENTE",
  });
  const response = await createPaymentIntentPostHandler({
    authorize: authorizeApiRequest,
    findReserva: async () => reservation() as never,
  })(request());

  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "FORBIDDEN");
});

test("TSK-BE-18 POST /api/payments/intent: rechaza reservaId inválido con 400", async () => {
  const response = await handler()(request({ reservaId: "no-es-uuid" }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
});

test("TSK-BE-18 POST /api/payments/intent: responde 404 si la reserva no existe", async () => {
  const response = await handler({ reserva: null })(request());
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "BOOKING_NOT_FOUND");
});

test("TSK-BE-18 POST /api/payments/intent: responde 409 si la reserva no se puede cobrar", async () => {
  const response = await handler({ reserva: reservation({ estado: "CONFIRMADA" }) })(request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "BOOKING_NOT_PAYABLE");
});

test("TSK-BE-18 POST /api/payments/intent: responde 403 si pertenece a otro vendedor", async () => {
  const response = await handler({ reserva: reservation({ vendedorId: "otro-vendedor" }) })(request());
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, "POS_BOOKING_FORBIDDEN");
});

test("TSK-BE-18 POST /api/payments/intent: responde 409 si falta el servicio relacionado", async () => {
  const response = await handler({ reserva: reservation({ disponibilidad: null }) })(request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "SERVICE_UNAVAILABLE");
});

test("TSK-BE-18 POST /api/payments/intent: mapea total inválido a 422", async () => {
  const response = await handler({
    createPaymentIntent: async () => { throw new Error("INVALID_CHECKOUT_AMOUNT"); },
  })(request());
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "INVALID_RESERVATION_TOTAL");
});

test("TSK-BE-18 POST /api/payments/intent: responde 201 con ambos nombres del client secret", async () => {
  const response = await handler()(request());
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.equal(body.data.reservaId, reservaId);
  assert.equal(body.data.paymentIntentId, "pi_pos_test");
  assert.equal(body.data.clientSecret, "pi_pos_test_secret_test");
  assert.equal(body.data.client_secret, body.data.clientSecret);
  assert.equal(body.data.amount, 7_500_000);
});
