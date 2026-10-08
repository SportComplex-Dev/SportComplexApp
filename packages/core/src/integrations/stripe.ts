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

export function buildPaymentMetadata(opts: { bookingId: string; userId: string }) {
  return { bookingId: opts.bookingId, userId: opts.userId, cashless: "true" };
}

/** Convierte un total decimal (COP) a centavos enteros para Stripe. */
export function toStripeAmountCents(
  total: number | string | { toString(): string },
): number {
  const numeric = Number(String(total));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("INVALID_CHECKOUT_AMOUNT");
  }
  const cents = Math.round(numeric * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("INVALID_CHECKOUT_AMOUNT");
  }
  return cents;
}

export interface CheckoutSessionInput {
  reservaId: string;
  userId: string;
  total: number | string | { toString(): string };
  cantidadCupos?: number;
  servicioNombre?: string;
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
  const unitAmount = toStripeAmountCents(input.total);
  const metadata = buildPaymentMetadata({
    bookingId: input.reservaId,
    userId: input.userId,
  });
  const productName =
    input.servicioNombre && input.servicioNombre.trim().length > 0
      ? `Reserva ${input.servicioNombre.trim()} x${input.cantidadCupos ?? 1}`
      : `Reserva ${input.reservaId} x${input.cantidadCupos ?? 1}`;

  return {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: STRIPE_CURRENCY,
          product_data: { name: productName },
          unit_amount: unitAmount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    expires_at: stripeSessionExpiresAtSec(now),
    success_url:
      input.successUrl ?? `${appUrl}/portal/tickets?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:
      input.cancelUrl ??
      `${appUrl}/portal/book?cancelled=${encodeURIComponent(input.reservaId)}`,
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

/** Superficie mínima del SDK usada por TSK-BE-09 (inyectable en tests). */
export interface StripeCheckoutClient {
  checkout: {
    sessions: {
      create(params: unknown, options?: unknown): Promise<Stripe.Checkout.Session>;
    };
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
 * Crea la Checkout Session (30 min) con `metadata { bookingId, userId }`.
 * `expiresAt` del resultado = expiración enviada a Stripe (coincide con el
 * TTL del hold `RESERVA.expira_en`, devuelto por TX1).
 *
 * NO toca la DB y NO crea `PAGO`: la reserva queda identificada por
 * `metadata.bookingId` y el `PAGO` se crea/asocia exclusivamente en el
 * webhook RF-09 (`checkout.session.completed` / `payment_intent.succeeded`),
 * cuando el `pi_...` realmente existe.
 *
 * Si esta función lanza, el llamador debe compensar el hold con
 * `compensateFailedCheckout(reservaId)`.
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
