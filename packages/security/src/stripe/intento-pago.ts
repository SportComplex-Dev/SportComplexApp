import type Stripe from "stripe";
import { getStripeClient, STRIPE_CURRENCY, stripeError } from "./cliente.js";
import type {
  BuildPaymentMetadataOptions,
  CreatePaymentIntentOptions,
  ParsedPaymentIntentMetadata,
  PosPaymentIntentInput,
  PosPaymentIntentResult,
  StripePaymentIntentClient,
  StripePaymentMetadata,
} from "./tipos.js";

/**
 * Metadatos obligatorios que deben viajar en todo PaymentIntent creado por el
 * backend. El webhook (`POST /api/payments`) los usa para clasificar y enlazar
 * el pago: sin `userId` el evento se ignora (no se puede persistir `PAGO`).
 */
export function buildPaymentMetadata(opts: BuildPaymentMetadataOptions): StripePaymentMetadata {
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
export function parsePaymentMetadata(
  metadata: Record<string, string> | undefined | null,
): ParsedPaymentIntentMetadata {
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

/** Alias retrocompatible con packages/core */
export const parsePaymentIntentMetadata = parsePaymentMetadata;

/**
 * Convierte `PaymentIntent.amount` (entero, 2 decimales en Stripe, ej. centavos
 * para COP: `7500000` → `"75000.00"`) al formato `Decimal(12,2)` de la tabla
 * `pago.monto`.
 */
export function stripeAmountToMonto(amount: number): string {
  return (amount / 100).toFixed(2);
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

function resolvePaymentIntentClient(explicit?: StripePaymentIntentClient): StripePaymentIntentClient {
  if (explicit) return explicit;
  return getStripeClient() as unknown as StripePaymentIntentClient;
}

/** Crea el PaymentIntent de taquilla en el servidor; el cliente solo confirma el clientSecret. */
export async function createPaymentIntent(
  input: PosPaymentIntentInput,
  deps: CreatePaymentIntentOptions = {},
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

/** Alias retrocompatible con core */
export const createPosPaymentIntent = createPaymentIntent;

/**
 * Consulta un PaymentIntent existente por su ID.
 */
export async function retrievePaymentIntent(
  paymentIntentId: string,
  deps: { client?: StripePaymentIntentClient } = {},
): Promise<Stripe.PaymentIntent> {
  const client = resolvePaymentIntentClient(deps.client);
  if (!client.paymentIntents.retrieve) {
    const fullClient = getStripeClient();
    return fullClient.paymentIntents.retrieve(paymentIntentId);
  }
  return client.paymentIntents.retrieve(paymentIntentId);
}
