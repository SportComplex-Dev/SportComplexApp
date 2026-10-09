import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutSessionParams,
  checkoutExpiresAt,
  CHECKOUT_TTL_MINUTES,
  createStripeCheckoutSession,
  extractPaymentIntentId,
  toStripeAmountCents,
} from "./stripe.js";

test("TSK-BE-09: checkoutExpiresAt = now + 30 min (TTL del hold = mínimo Stripe)", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  assert.equal(
    checkoutExpiresAt(now).getTime(),
    now.getTime() + CHECKOUT_TTL_MINUTES * 60_000,
  );
});

test("TSK-BE-09: toStripeAmountCents convierte decimales a centavos", () => {
  assert.equal(toStripeAmountCents(2500), 250_000);
  assert.equal(toStripeAmountCents("2500.00"), 250_000);
  assert.equal(toStripeAmountCents({ toString: () => "1234.56" }), 123_456);
  assert.throws(() => toStripeAmountCents(0), /INVALID_CHECKOUT_AMOUNT/);
  assert.throws(() => toStripeAmountCents("abc"), /INVALID_CHECKOUT_AMOUNT/);
});

test("TSK-BE-09: buildCheckoutSessionParams usa expires_at de 30 min (TTL unificado) y metadata para multi-item", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const params = buildCheckoutSessionParams(
    {
      reservaIds: ["r-1", "r-2"],
      userId: "u-1",
      total: 7500,
      items: [
        { reservaId: "r-1", servicioNombre: "Cancha 1", cantidadCupos: 2, subtotal: 5000 },
        { reservaId: "r-2", servicioNombre: "Piscina 1", cantidadCupos: 1, subtotal: 2500 },
      ],
      now,
    },
    "http://localhost:3000",
  );
  assert.equal(params.mode, "payment");
  assert.equal(params.expires_at, Math.floor((now.getTime() + 30 * 60_000) / 1000));
  assert.deepEqual(params.metadata, { bookingId: "r-1,r-2", userId: "u-1", cashless: "true" });
  assert.deepEqual(params.payment_intent_data?.metadata, params.metadata);
  assert.equal(params.line_items?.length, 2);
  const item1 = params.line_items?.[0];
  assert.equal(item1?.price_data?.currency, "cop");
  assert.equal(item1?.price_data?.unit_amount, 500_000);
  assert.equal(item1?.price_data?.product_data?.name, "Reserva Cancha 1 x2");
  const item2 = params.line_items?.[1];
  assert.equal(item2?.price_data?.unit_amount, 250_000);
  assert.equal(item2?.price_data?.product_data?.name, "Reserva Piscina 1 x1");
});

test("TSK-BE-09: extractPaymentIntentId soporta string y objeto expandido", () => {
  assert.equal(extractPaymentIntentId({ payment_intent: "pi_123" }), "pi_123");
  assert.equal(
    extractPaymentIntentId({ payment_intent: { id: "pi_abc" } as never }),
    "pi_abc",
  );
  assert.equal(extractPaymentIntentId({ payment_intent: null }), null);
});

test("TSK-BE-09: createStripeCheckoutSession devuelve el PI si viene expandido", async () => {
  const fake = {
    checkout: {
      sessions: {
        async create() {
          return {
            id: "cs_test_1",
            url: "https://checkout.stripe.com/pay/cs_test_1",
            payment_intent: { id: "pi_test_1" },
          } as never;
        },
      },
    },
  };
  const result = await createStripeCheckoutSession(
    { reservaIds: ["r-1"], userId: "u-1", total: 1000, items: [{ reservaId: "r-1", servicioNombre: "Test", cantidadCupos: 1, subtotal: 1000 }] },
    { client: fake },
  );
  assert.equal(result.sessionId, "cs_test_1");
  assert.equal(result.paymentIntentId, "pi_test_1");
});

test("TSK-BE-09: createStripeCheckoutSession NO exige PI al crear la sesión (RF-09 lo recibirá)", async () => {
  const fake = {
    checkout: {
      sessions: {
        async create() {
          return { id: "cs_test_2", url: null, payment_intent: null } as never;
        },
      },
    },
  };
  const result = await createStripeCheckoutSession(
    { reservaIds: ["r-2"], userId: "u-2", total: 1000, items: [{ reservaId: "r-2", servicioNombre: "Test", cantidadCupos: 1, subtotal: 1000 }] },
    { client: fake },
  );
  assert.equal(result.sessionId, "cs_test_2");
  assert.equal(result.paymentIntentId, null);
});

test("TSK-BE-09: createStripeCheckoutSession envuelve errores del SDK en STRIPE_CHECKOUT_FAILED", async () => {
  const fake = {
    checkout: {
      sessions: {
        async create() {
          throw new Error("card_declined");
        },
        async retrieve() {
          throw new Error("unreachable");
        },
      },
    },
  };
  await assert.rejects(
    () =>
      createStripeCheckoutSession(
        { reservaIds: ["r-4"], userId: "u-4", total: 1000, items: [{ reservaId: "r-4", servicioNombre: "Test", cantidadCupos: 1, subtotal: 1000 }] },
        { client: fake },
      ),
    (err: unknown) =>
      err instanceof Error &&
      (err as { code?: string }).code === "STRIPE_CHECKOUT_FAILED",
  );
});