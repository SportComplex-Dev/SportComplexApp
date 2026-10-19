// Cashless Engine — Stripe intenciones + suscripciones (RF-09/RF-16/RF-17).
// Sin efectivo (RN-13). Webhook verifica firma + idempotencia por event id.
//
// TSK-BE-09 — Checkout Session con TTL 30 min (HU-09 / RF-08 / RN-04 rev.).
// El TTL AUTORITATIVO es `RESERVA.expira_en = now + 30 min` (DB): pasado ese
// tiempo el job `expireReservasVencidas` + la limpieza perezosa liberan el
// cupo.
//
// `expires_at` exige mínimo 30 min por plataforma de Stripe, así que sesión
// y hold comparten el mismo horizonte (30 min): no hay ventana huérfana en
// la que el link de pago siga vivo con el cupo ya liberado.

import Stripe from "stripe";
import { CHECKOUT_TTL_MINUTES } from "../domain/index";
import { checkoutExpiresAt } from "../services/availability";

/** Mínimo de plataforma de Stripe para `expires_at` de una Checkout Session
 * (30 min). Es también el TTL del hold `RESERVA.expira_en` (RN-04 revisada). */
export const STRIPE_SESSION_MIN_TTL_MINUTES = 30 as const;

/** Monto mínimo (COP) que cobra Stripe: equivale a ~0,50 USD; por debajo rechaza el pago. */
export const STRIPE_MIN_AMOUNT_COP = 2000 as const;

/** `expires_at` efectivo enviado a Stripe (segundos Unix). */
function stripeSessionExpiresAtSec(from: Date): number {
  const minTtlMs = STRIPE_SESSION_MIN_TTL_MINUTES * 60 * 1000;
  const holdTtlMs = CHECKOUT_TTL_MINUTES * 60 * 1000;
  return Math.floor((from.getTime() + Math.max(minTtlMs, holdTtlMs)) / 1000);
}

export const STRIPE_CURRENCY = "cop" as const;

// Re-exportados para conveniencia del flujo de checkout (definidos en
// `domain/index.ts` y `services/availability.ts`; no duplicar).
export { CHECKOUT_TTL_MINUTES, checkoutExpiresAt };

/**
 * Metadatos obligatorios que deben viajar en todo PaymentIntent creado por el
 * backend. El webhook (`POST /api/payments`) los usa para clasificar y enlazar
 * el pago: sin `userId` el evento se ignora (no se puede persistir `PAGO`).
 */
export function buildPaymentMetadata(opts: {
  bookingId?: string;
  userId: string;
  membershipId?: string;
  serviceId?: number;
  vendedorId?: string;
}) {
  return {
    ...(opts.bookingId ? { bookingId: opts.bookingId } : {}),
    userId: opts.userId,
    ...(opts.membershipId ? { membershipId: opts.membershipId } : {}),
    ...(opts.serviceId !== undefined ? { servicio_id: String(opts.serviceId) } : {}),
    ...(opts.vendedorId ? { vendedor_id: opts.vendedorId } : {}),
    cashless: "true",
  };
}

/**
 * Metadatos leídos del PaymentIntent que llega en el webhook.
 * `userId` es la única obligatoria; `bookingId`/`bookingIds`/`membershipId` determinan el
 * tipo de pago (RESERVA / MEMBRESIA).
 */
export function parsePaymentIntentMetadata(metadata: Record<string, string> | undefined | null) {
  const rawBookingIds = metadata?.bookingIds || metadata?.bookingId || undefined;
  const bookingIds = rawBookingIds
    ? rawBookingIds.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return {
    userId: metadata?.userId || undefined,
    bookingId: metadata?.bookingId || undefined,
    bookingIds,
    membershipId: metadata?.membershipId || undefined,
    vendedorId: metadata?.vendedor_id || undefined,
    serviceId:
      metadata?.servicio_id && /^\d+$/.test(metadata.servicio_id)
        ? Number(metadata.servicio_id)
        : undefined,
  };
}

/**
 * Convierte `PaymentIntent.amount` (entero, 2 decimales en Stripe, ej. centavos
 * para COP: `7500000` → `"75000.00"`) al formato `Decimal(12,2)` de la tabla
 * `pago.monto`.
 */
export function stripeAmountToMonto(amount: number): string {
  return (amount / 100).toFixed(2);
}

/** Convierte un total decimal (COP) a centavos enteros para Stripe y valida el monto mínimo. */
export function toStripeAmountCents(
  total: number | string | { toString(): string },
  options?: { allowBelowMin?: boolean; minAmount?: number },
): number {
  const numeric = Number(String(total));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("INVALID_CHECKOUT_AMOUNT");
  }
  const min = options?.minAmount ?? STRIPE_MIN_AMOUNT_COP;
  if (!options?.allowBelowMin && numeric < min) {
    throw new Error(`AMOUNT_BELOW_STRIPE_MINIMUM: El monto ($${numeric.toLocaleString("es-CO")} COP) es inferior al mínimo aceptado por Stripe ($${min.toLocaleString("es-CO")} COP).`);
  }
  const cents = Math.round(numeric * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("INVALID_CHECKOUT_AMOUNT");
  }
  return cents;
}

export interface PosPaymentIntentInput {
  bookingId: string;
  userId: string;
  serviceId: number;
  vendedorId: string;
  total: number | string | { toString(): string };
}

export interface StripePaymentIntentClient {
  paymentIntents: {
    create(params: unknown, options?: unknown): Promise<Stripe.PaymentIntent>;
  };
}

export interface PosPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

export function buildPosPaymentIntentParams(input: PosPaymentIntentInput) {
  if (!Number.isSafeInteger(input.serviceId) || input.serviceId <= 0) {
    throw new Error("INVALID_POS_SERVICE_ID");
  }
  if (!input.bookingId.trim() || !input.userId.trim() || !input.vendedorId.trim()) {
    throw new Error("INVALID_POS_PAYMENT_METADATA");
  }

  return {
    amount: toStripeAmountCents(input.total),
    currency: STRIPE_CURRENCY,
    payment_method_types: ["card"],
    metadata: buildPaymentMetadata({
      bookingId: input.bookingId,
      userId: input.userId,
      serviceId: input.serviceId,
      vendedorId: input.vendedorId,
    }),
    description: `Reserva POS ${input.bookingId}`,
  };
}

function resolvePaymentIntentClient(explicit?: StripePaymentIntentClient) {
  if (explicit) return explicit;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("STRIPE_NOT_CONFIGURED");
  return new Stripe(secret) as unknown as StripePaymentIntentClient;
}

/** Crea el PaymentIntent de taquilla en el servidor; el cliente solo confirma el clientSecret. */
export async function createPosPaymentIntent(
  input: PosPaymentIntentInput,
  deps: { client?: StripePaymentIntentClient; idempotencyKey?: string } = {},
): Promise<PosPaymentIntentResult> {
  const params = buildPosPaymentIntentParams(input);
  const client = resolvePaymentIntentClient(deps.client);

  let intent: Stripe.PaymentIntent;
  try {
    intent = await client.paymentIntents.create(
      params,
      deps.idempotencyKey ? { idempotencyKey: deps.idempotencyKey } : undefined,
    );
  } catch (err) {
    throw stripeError(
      "STRIPE_PAYMENT_INTENT_FAILED",
      err instanceof Error ? err.message : String(err),
      { cause: err },
    );
  }
  if (!intent.id || !intent.client_secret) {
    throw stripeError("STRIPE_PAYMENT_INTENT_INVALID", "Stripe no devolvió un client_secret.");
  }
  if (
    intent.metadata.bookingId !== input.bookingId ||
    intent.metadata.userId !== input.userId ||
    intent.metadata.servicio_id !== String(input.serviceId) ||
    intent.metadata.vendedor_id !== input.vendedorId ||
    intent.amount !== params.amount
  ) {
    throw stripeError(
      "POS_PAYMENT_INTENT_CONFLICT",
      "La reserva ya tiene un PaymentIntent asociado a otros datos POS.",
    );
  }

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
  };
}

export interface CheckoutSessionItem {
  reservaId: string;
  servicioNombre: string;
  cantidadCupos: number;
  subtotal: number;
}

export interface CheckoutSessionInput {
  reservaIds: string[];
  userId: string;
  total: number | string | { toString(): string };
  items: CheckoutSessionItem[];
  /** Inyectable para tests; por defecto `new Date()`. */
  now?: Date;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResult {
  sessionId: string;
  url: string | null;
  /** `pi_...` solo existe tras `checkout.session.completed` (RF-09); en la
   * creación es `null` por diseño de la API actual de Stripe. */
  paymentIntentId: string | null;
  expiresAt: Date;
}

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
    const productName = item.servicioNombre.trim().length > 0
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
      `${appUrl}/portal/book?cancelled=${encodeURIComponent(input.reservaIds[0])}`,
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

/** Superficie mínima del SDK usada por TSK-BE-09 y TSK-BE-20 (inyectable en tests). */
export interface StripeCheckoutClient {
  checkout: {
    sessions: {
      create(params: unknown, options?: unknown): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptions?: {
    create(params: unknown, options?: unknown): Promise<Stripe.Subscription>;
    retrieve?(id: string, options?: unknown): Promise<Stripe.Subscription>;
  };
}

function resolveClient(explicit?: StripeCheckoutClient): StripeCheckoutClient {
  if (explicit) return explicit;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }
  return new Stripe(secret) as unknown as StripeCheckoutClient;
}

function stripeError(code: string, detail: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`${code}: ${detail}`), { code, ...extra });
}

/**
 * Crea la Checkout Session (30 min) con `metadata { bookingIds: "id1,id2,...", userId }`.
 * `expiresAt` del resultado = expiración enviada a Stripe (coincide con el
 * TTL del hold `RESERVA.expira_en`, devuelto por TX1).
 *
 * NO toca la DB y NO crea `PAGO`: las reservas quedan identificadas por
 * `metadata.bookingIds` y el `PAGO` se crea/asocia exclusivamente en el
 * webhook RF-09 (`checkout.session.completed` / `payment_intent.succeeded`),
 * cuando el `pi_...` realmente existe.
 *
 * Si esta función lanza, el llamador debe compensar los holds con
 * `compensateFailedCheckout(reservaId)` para cada reserva.
 */
export async function createStripeCheckoutSession(
  input: CheckoutSessionInput,
  deps: { client?: StripeCheckoutClient; appUrl?: string } = {},
): Promise<CheckoutSessionResult> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(stripeSessionExpiresAtSec(now) * 1000);
  const params = buildCheckoutSessionParams(input, deps.appUrl ?? defaultAppUrl());
  const client = resolveClient(deps.client);

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

  // Nota (API 2026-08-26.dahlia): `payment_intent` es null hasta que el
  // cliente completa el pago; no se reintenta ni se falla por ello.
  return {
    sessionId: session.id,
    url: session.url ?? null,
    paymentIntentId: extractPaymentIntentId(session),
    expiresAt,
  };
}

export interface CreateSubscriptionInput {
  customerId: string;
  priceId: string;
  userId: string;
  planId: number | string;
  membershipId?: number | string;
  metadata?: Record<string, string>;
}

export interface StripeSubscriptionResult {
  subscriptionId: string;
  status: string;
  customerId: string;
  currentPeriodEnd: Date;
}

/**
 * TSK-BE-20 (RF-16 / RN-09): Creación directa de suscripciones recurrentes en Stripe.
 */
export async function createStripeSubscription(
  input: CreateSubscriptionInput,
  deps: { client?: StripeCheckoutClient } = {},
): Promise<StripeSubscriptionResult> {
  const client = resolveClient(deps.client);
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
      customerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? input.customerId,
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

export interface SubscriptionCheckoutSessionInput {
  userId: string;
  planId: number | string;
  priceId: string;
  customerId?: string;
  customerEmail?: string;
  membershipId?: number | string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
  now?: Date;
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
    cancel_url:
      input.cancelUrl ?? `${appUrl}/portal/membership?cancelled=true`,
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
  const client = resolveClient(deps.client);

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

export interface ParsedInvoiceData {
  invoiceId: string;
  subscriptionId: string | null;
  paymentIntentId: string | null;
  customerId: string | null;
  amount: number;
  periodEnd: Date | null;
  userId: string | null;
  planId: string | null;
  membershipId: string | null;
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
