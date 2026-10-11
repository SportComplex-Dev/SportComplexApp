import Stripe from "stripe";
import { PaymentError, procesarPagoWebhook } from "@sportcomplex/db";
import { parsePaymentIntentMetadata, stripeAmountToMonto } from "@sportcomplex/core";
import { ok, fail } from "@/lib/api-response";

// RF-09 / RF-16 / RF-17 — Stripe webhook con firma + idempotencia (TSK-BD-09).
// Endpoint a registrar en el dashboard de Stripe:
//   POST https://<dominio>/api/payments
// Stripe reenvía el mismo evento ante timeouts/errores; la idempotencia es
// total: verificar firma → procesarPagoWebhook (UNIQUE stripe_payment_intent_id
// + updates condicionales) → siempre 200 si el evento fue procesado o ignorado.

const EVENTOS_PROCESABLES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return fail(
      "STRIPE_NOT_CONFIGURED",
      "Faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET.",
      503,
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return fail("MISSING_SIGNATURE", "Falta el header stripe-signature.", 400);
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    // Verificación de firma: rechaza payloads manipulados/firmados por otro.
    event = new Stripe(secretKey).webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch {
    return fail("INVALID_SIGNATURE", "Firma Stripe inválida.", 400);
  }

  if (!EVENTOS_PROCESABLES.has(event.type)) {
    // 200 a propósito: Stripe dejaría de reintentar igualmente y el tipo de
    // evento no es responsabilidad de este endpoint.
    return ok({ received: true, ignored: true, reason: "EVENT_TYPE_NOT_HANDLED" });
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const { userId, bookingId, bookingIds, membershipId } = parsePaymentIntentMetadata(intent.metadata);
  const effectiveBookingIds =
    bookingIds && bookingIds.length > 0
      ? bookingIds
      : bookingId
        ? [bookingId]
        : [];
  const hasBookings = effectiveBookingIds.length > 0;

  if (!intent.id || !userId || (!hasBookings && !membershipId)) {
    // Evento sin nuestro metadato (otro flujo de Stripe): no es procesable.
    return ok({ received: true, ignored: true, reason: "MISSING_METADATA" });
  }

  try {
    const resultado = await procesarPagoWebhook({
      stripePaymentIntentId: intent.id,
      usuarioId: userId,
      monto: stripeAmountToMonto(intent.amount ?? 0),
      estado:
        event.type === "payment_intent.succeeded" ? "APROBADO" : "FALLIDO",
      tipo: hasBookings ? "RESERVA" : "MEMBRESIA",
      ...(hasBookings
        ? {
            reservaId: effectiveBookingIds.length === 1 ? effectiveBookingIds[0] : undefined,
            reservaIds: effectiveBookingIds,
          }
        : {}),
      membresiaId: membershipId ? Number(membershipId) : undefined,
    });
    // Reintentos de Stripe quedan en 200 con duplicado=true: nada se duplica.
    return ok({ received: true, ...resultado });
  } catch (error: unknown) {
    if (error instanceof PaymentError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/payments (webhook Stripe):", error);
    // 500 → Stripe reintenta; la próxima corrida es idempotente.
    return fail("SERVER_ERROR", "Error al procesar el evento de pago.", 500);
  }
}
