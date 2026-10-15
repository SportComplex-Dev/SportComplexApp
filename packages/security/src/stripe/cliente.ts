import Stripe from "stripe";
import { CHECKOUT_TTL_MINUTES } from "@sportcomplex/domain";

/** Mínimo de plataforma de Stripe para `expires_at` de una Checkout Session
 * (30 min). Es también el TTL del hold `RESERVA.expira_en` (RN-04 revisada). */
export const STRIPE_SESSION_MIN_TTL_MINUTES = 30 as const;

export const STRIPE_CURRENCY = "cop" as const;

/** `expires_at` efectivo enviado a Stripe (segundos Unix). */
export function stripeSessionExpiresAtSec(from: Date): number {
  const minTtlMs = STRIPE_SESSION_MIN_TTL_MINUTES * 60 * 1000;
  const holdTtlMs = CHECKOUT_TTL_MINUTES * 60 * 1000;
  return Math.floor((from.getTime() + Math.max(minTtlMs, holdTtlMs)) / 1000);
}

/**
 * Obtiene una instancia configurada del cliente Stripe.
 * Lee STRIPE_SECRET_KEY del entorno si no se proporciona explícitamente.
 */
export function getStripeClient(apiKey?: string): Stripe {
  const secret = apiKey ?? process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }
  return new Stripe(secret);
}

export function stripeError(code: string, detail: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`${code}: ${detail}`), { code, ...extra });
}
