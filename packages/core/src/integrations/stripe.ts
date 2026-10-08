// Cashless Engine — Stripe intenciones + suscripciones (RF-09/RF-16/RF-17).
// Sin efectivo (RN-13). Webhook verifica firma + idempotencia por event id.

export const STRIPE_CURRENCY = "cop" as const;

/**
 * Metadatos obligatorios que deben viajar en todo PaymentIntent creado por el
 * backend. El webhook (`POST /api/payments`) los usa para clasificar y enlazar
 * el pago: sin `userId` el evento se ignora (no se puede persistir `PAGO`).
 */
export function buildPaymentMetadata(opts: {
  bookingId?: string;
  userId: string;
  membershipId?: string;
}) {
  return {
    ...(opts.bookingId ? { bookingId: opts.bookingId } : {}),
    userId: opts.userId,
    ...(opts.membershipId ? { membershipId: opts.membershipId } : {}),
    cashless: "true",
  };
}

/**
 * Metadatos leídos del PaymentIntent que llega en el webhook.
 * `userId` es la única obligatoria; `bookingId`/`membershipId` determinan el
 * tipo de pago (RESERVA / MEMBRESIA).
 */
export function parsePaymentIntentMetadata(metadata: Record<string, string> | undefined | null) {
  return {
    userId: metadata?.userId || undefined,
    bookingId: metadata?.bookingId || undefined,
    membershipId: metadata?.membershipId || undefined,
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
