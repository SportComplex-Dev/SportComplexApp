import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCheckoutSessionParams,
  checkoutExpiresAt,
  CHECKOUT_TTL_MINUTES,
  createStripeCheckoutSession,
  extractPaymentIntentId,
  parsePaymentIntentMetadata,
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

test("SCRUM-163: parsePaymentIntentMetadata parsea bookingId CSV o bookingIds a array", () => {
  // Caso CSV en bookingId
  const parsed1 = parsePaymentIntentMetadata({
    bookingId: "r-1,r-2,r-3",
    userId: "u-1",
  });
  assert.equal(parsed1.userId, "u-1");
  assert.deepEqual(parsed1.bookingIds, ["r-1", "r-2", "r-3"]);

  // Caso bookingIds explícito
  const parsed2 = parsePaymentIntentMetadata({
    bookingIds: "r-a,r-b",
    userId: "u-2",
  });
  assert.equal(parsed2.userId, "u-2");
  assert.deepEqual(parsed2.bookingIds, ["r-a", "r-b"]);

  // Caso individual (1 reserva)
  const parsed3 = parsePaymentIntentMetadata({
    bookingId: "r-single",
    userId: "u-3",
  });
  assert.equal(parsed3.bookingId, "r-single");
  assert.deepEqual(parsed3.bookingIds, ["r-single"]);
});

test("TSK-BE-20: buildSubscriptionCheckoutSessionParams genera parámetros con mode: subscription y metadata", async () => {
  const { buildSubscriptionCheckoutSessionParams } = await import("./stripe.js");
  const params = buildSubscriptionCheckoutSessionParams(
    {
      userId: "u-100",
      planId: 2,
      priceId: "price_mensual_123",
      customerEmail: "user@example.com",
    },
    "http://localhost:3000",
  );

  assert.equal(params.mode, "subscription");
  assert.deepEqual(params.line_items, [{ price: "price_mensual_123", quantity: 1 }]);
  assert.equal(params.customer_email, "user@example.com");
  assert.deepEqual(params.metadata, {
    userId: "u-100",
    planId: "2",
    cashless: "true",
  });
});

test("TSK-BE-20: createStripeSubscription llama a client.subscriptions.create y retorna resultado", async () => {
  const { createStripeSubscription } = await import("./stripe.js");
  const fake = {
    checkout: { sessions: { create: async () => ({} as never) } },
    subscriptions: {
      async create(params: Record<string, unknown>) {
        return {
          id: "sub_test_123",
          status: "active",
          customer: params.customer,
          current_period_end: 1770000000,
        } as never;
      },
    },
  };

  const result = await createStripeSubscription(
    {
      customerId: "cus_abc",
      priceId: "price_123",
      userId: "u-sub-1",
      planId: 1,
    },
    { client: fake },
  );

  assert.equal(result.subscriptionId, "sub_test_123");
  assert.equal(result.status, "active");
  assert.equal(result.customerId, "cus_abc");
  assert.equal(result.currentPeriodEnd.getTime(), 1770000000 * 1000);
});

test("TSK-BE-20: parseInvoiceEventData extrae datos de invoice.paid e invoice.payment_failed", async () => {
  const { parseInvoiceEventData } = await import("./stripe.js");

  const rawInvoice = {
    id: "in_test_invoice_99",
    subscription: "sub_xyz",
    payment_intent: "pi_invoice_123",
    customer: "cus_customer_1",
    amount_paid: 18000000,
    lines: {
      data: [
        {
          period: {
            end: 1775000000,
          },
        },
      ],
    },
    metadata: {
      userId: "u-99",
      planId: "3",
      membershipId: "42",
    },
  };

  const parsed = parseInvoiceEventData(rawInvoice);
  assert.equal(parsed.invoiceId, "in_test_invoice_99");
  assert.equal(parsed.subscriptionId, "sub_xyz");
  assert.equal(parsed.paymentIntentId, "pi_invoice_123");
  assert.equal(parsed.customerId, "cus_customer_1");
  assert.equal(parsed.amount, 18000000);
  assert.equal(parsed.periodEnd?.getTime(), 1775000000 * 1000);
  assert.equal(parsed.userId, "u-99");
  assert.equal(parsed.planId, "3");
  assert.equal(parsed.membershipId, "42");
});