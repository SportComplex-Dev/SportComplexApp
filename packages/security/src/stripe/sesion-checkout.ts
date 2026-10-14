import type Stripe from "stripe";
import { getStripeClient, STRIPE_CURRENCY, stripeError, stripeSessionExpiresAtSec } from "./cliente.js";
import { buildPaymentMetadata, toStripeAmountCents } from "./intento-pago.js";
import type {
  CheckoutSessionInput,
  CheckoutSessionResult,
  CreateCheckoutSessionOptions,
  CreateSubscriptionInput,
  ParsedInvoiceData,
  StripeCheckoutClient,
  StripeSubscriptionResult,
  SubscriptionCheckoutSessionInput,
} from "./tipos.js";

function defaultAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/**
 * Parámetros puros para `stripe.checkout.sessions.create`.
 * Función pura (sin I/O) para facilitar tests.
 */
export function buildCheckoutSessionParams(
  input: CheckoutSessionInput,
  appUrl = defaultAppUrl(),
): Stripe.Checkout.SessionCreateParams {
  const now = input.now ?? new Date();
  toStripeAmountCents(input.total);
  const metadata = buildPaymentMetadata({
    bookingId: input.reservaIds.join(","),
    userId: input.userId,
  });

  const lineItems = input.items.map((item) => {
    const productName =
      item.servicioNombre.trim().length > 0
        ? `Reserva ${item.servicioNombre.trim()} x${item.cantidadCupos}`
        : `Reserva ${item.reservaId} x${item.cantidadCupos}`;
    const itemAmount = toStripeAmountCents(item.subtotal);
    return {
      price_data: {
        currency: STRIPE_CURRENCY,
        product_data: { name: productName },
        unit_amount: itemAmount,
      },
      quantity: 1,
    };
  });

  return {
    mode: "payment",
    line_items: lineItems,
    metadata,
    payment_intent_data: { metadata },
    expires_at: stripeSessionExpiresAtSec(now),
    success_url:
      input.successUrl ?? `${appUrl}/portal/tickets?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      input.cancelUrl ??
      `${appUrl}/portal/book?cancelled=${encodeURIComponent(input.reservaIds[0] ?? "")}`,
  };
}

/** Extrae `pi_...` de una Checkout Session (string u objeto expandido). */
export function extractPaymentIntentId(
  session: Pick<Stripe.Checkout.Session, "payment_intent">,
): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string" && pi.startsWith("pi_")) return pi;
  if (pi !== null && typeof pi === "object" && "id" in pi) {
    const id = (pi as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }
  return null;
}

function resolveCheckoutClient(explicit?: StripeCheckoutClient): StripeCheckoutClient {
  if (explicit) return explicit;
  return getStripeClient() as unknown as StripeCheckoutClient;
}

/**
 * Crea la Checkout Session (30 min) con `metadata { bookingIds: "id1,id2,...", userId }`.
 */
export async function createCheckoutSession(
  input: CheckoutSessionInput,
  deps: CreateCheckoutSessionOptions = {},
): Promise<CheckoutSessionResult> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(stripeSessionExpiresAtSec(now) * 1000);
  const params = buildCheckoutSessionParams(input, deps.appUrl ?? defaultAppUrl());
  const client = resolveCheckoutClient(deps.client);

  let session: Stripe.Checkout.Session;
  try {
    session = await client.checkout.sessions.create(params);
  } catch (err) {
    throw stripeError(
      "STRIPE_CHECKOUT_FAILED",
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }

  return {
    sessionId: session.id,
    url: session.url ?? null,
    paymentIntentId: extractPaymentIntentId(session),
    expiresAt,
  };
}

/** Alias retrocompatible con packages/core */
export const createStripeCheckoutSession = createCheckoutSession;

/**
 * Expira una sesión de checkout activa en Stripe.
 */
export async function expireCheckoutSession(
  sessionId: string,
  deps: { client?: StripeCheckoutClient } = {},
): Promise<Stripe.Checkout.Session> {
  const client = resolveCheckoutClient(deps.client);
  if (!client.checkout.sessions.expire) {
    const fullClient = getStripeClient();
    return fullClient.checkout.sessions.expire(sessionId);
  }
  return client.checkout.sessions.expire(sessionId);
}

/**
 * TSK-BE-20 (RF-16 / RN-09): Creación directa de suscripciones recurrentes en Stripe.
 */
export async function createStripeSubscription(
  input: CreateSubscriptionInput,
  deps: { client?: StripeCheckoutClient } = {},
): Promise<StripeSubscriptionResult> {
  const client = resolveCheckoutClient(deps.client);
  if (!client.subscriptions?.create) {
    throw stripeError("STRIPE_NOT_SUPPORTED", "Subscriptions API no disponible en este cliente.");
  }

  const metadata = {
    userId: input.userId,
    planId: String(input.planId),
    ...(input.membershipId ? { membershipId: String(input.membershipId) } : {}),
    ...(input.metadata ?? {}),
    cashless: "true",
  };

  try {
    const subscription = await client.subscriptions.create({
      customer: input.customerId,
      items: [{ price: input.priceId }],
      metadata,
    });

    const periodEndSec = (subscription as unknown as { current_period_end?: number }).current_period_end;
    const currentPeriodEnd = periodEndSec ? new Date(periodEndSec * 1000) : new Date();

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      customerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? input.customerId,
      currentPeriodEnd,
    };
  } catch (err) {
    throw stripeError(
      "STRIPE_SUBSCRIPTION_FAILED",
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }
}

export function buildSubscriptionCheckoutSessionParams(
  input: SubscriptionCheckoutSessionInput,
  appUrl = defaultAppUrl(),
): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    userId: input.userId,
    planId: String(input.planId),
    ...(input.membershipId ? { membershipId: String(input.membershipId) } : {}),
    cashless: "true",
  };

  const now = input.now ?? new Date();

  return {
    mode: "subscription",
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata },
    expires_at: stripeSessionExpiresAtSec(now),
    ...(input.customerId ? { customer: input.customerId } : {}),
    ...(input.customerEmail && !input.customerId ? { customer_email: input.customerEmail } : {}),
    success_url:
      input.successUrl ?? `${appUrl}/portal/membership?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: input.cancelUrl ?? `${appUrl}/portal/membership?cancelled=true`,
  };
}

/**
 * Inicia una sesión de checkout en modo `subscription` para adquirir membresías online.
 */
export async function createStripeSubscriptionCheckoutSession(
  input: SubscriptionCheckoutSessionInput,
  deps: { client?: StripeCheckoutClient; appUrl?: string } = {},
): Promise<{ sessionId: string; url: string | null; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(stripeSessionExpiresAtSec(now) * 1000);
  const params = buildSubscriptionCheckoutSessionParams(input, deps.appUrl ?? defaultAppUrl());
  const client = resolveCheckoutClient(deps.client);

  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    `sub_checkout_${input.userId}_${input.planId}`;

  try {
    const session = await client.checkout.sessions.create(params, {
      idempotencyKey,
    });
    return {
      sessionId: session.id,
      url: session.url ?? null,
      expiresAt,
    };
  } catch (err) {
    throw stripeError(
      "STRIPE_SUBSCRIPTION_CHECKOUT_FAILED",
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }
}

/**
 * TSK-BE-20: Parsea eventos invoice.paid e invoice.payment_failed provenientes de Stripe Webhook.
 */
export function parseInvoiceEventData(
  invoice: Record<string, unknown> | Stripe.Invoice,
): ParsedInvoiceData {
  const inv = invoice as {
    id: string;
    subscription?: string | { id: string } | null;
    payment_intent?: string | { id: string } | null;
    customer?: string | { id: string } | null;
    amount_paid?: number;
    amount_due?: number;
    total?: number;
    period_end?: number;
    lines?: { data?: Array<{ period?: { end?: number }; metadata?: Record<string, string> }> };
    metadata?: Record<string, string>;
    subscription_details?: { metadata?: Record<string, string> };
    parent?: {
      subscription_details?: { metadata?: Record<string, string> };
      metadata?: Record<string, string>;
      subscription?: string | { id: string } | null;
    };
  };

  const invoiceId = inv.id;
  const subscriptionId =
    typeof inv.subscription === "string"
      ? inv.subscription
      : (inv.subscription as { id?: string } | undefined)?.id ??
        (typeof inv.parent?.subscription === "string"
          ? inv.parent.subscription
          : (inv.parent?.subscription as { id?: string } | undefined)?.id) ??
        null;

  const paymentIntentId =
    typeof inv.payment_intent === "string"
      ? inv.payment_intent
      : inv.payment_intent?.id ?? null;

  const customerId =
    typeof inv.customer === "string"
      ? inv.customer
      : inv.customer?.id ?? null;

  const amount = inv.amount_paid ?? inv.amount_due ?? inv.total ?? 0;

  let periodEnd: Date | null = null;
  if (inv.lines?.data?.[0]?.period?.end) {
    periodEnd = new Date(inv.lines.data[0].period.end * 1000);
  } else if (inv.period_end) {
    periodEnd = new Date(inv.period_end * 1000);
  }

  const meta = {
    ...(inv.lines?.data?.[0]?.metadata ?? {}),
    ...(inv.parent?.metadata ?? {}),
    ...(inv.parent?.subscription_details?.metadata ?? {}),
    ...(inv.subscription_details?.metadata ?? {}),
    ...(inv.metadata ?? {}),
  };
  const userId = meta.userId || meta.user_id || null;
  const planId = meta.planId || meta.plan_id || null;
  const membershipId = meta.membershipId || meta.membership_id || null;

  return {
    invoiceId,
    subscriptionId,
    paymentIntentId,
    customerId,
    amount,
    periodEnd,
    userId,
    planId,
    membershipId,
  };
}
