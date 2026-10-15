import Stripe from "stripe";
import { PaymentError, procesarPagoWebhook, procesarFacturaWebhook } from "@sportcomplex/db";
import {
  newTicketId,
  parsePaymentIntentMetadata,
  parseInvoiceEventData,
  stripeAmountToMonto,
} from "@sportcomplex/core";
import { ok, fail } from '@sportcomplex/shared/lib';
import { sendContingencyWebhook } from '@sportcomplex/shared/lib';
import { clearPendingSubscriptionCheckout } from "@/app/api/memberships/subscribe/route";

// RF-09 / RF-16 / RF-17 — Stripe webhook con firma + idempotencia (TSK-BD-09 / TSK-BE-20).
// Endpoint a registrar en el dashboard de Stripe:
//   POST https://<dominio>/api/payments
// Stripe reenvía el mismo evento ante timeouts/errores; la idempotencia es
// total: verificar firma → procesarPagoWebhook / procesarFacturaWebhook
// → siempre 200 si el evento fue procesado o ignorado.

const EVENTOS_PROCESABLES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
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

  // TSK-BE-20: Manejo de suscripciones recurrentes y renovación proxima_renovacion
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const parsed = parseInvoiceEventData(invoice);

    if (!parsed.invoiceId) {
      return ok({ received: true, ignored: true, reason: "MISSING_INVOICE_ID" });
    }

    try {
      const resultado = await procesarFacturaWebhook({
        stripeInvoiceId: parsed.invoiceId,
        stripeSubscriptionId: parsed.subscriptionId,
        stripePaymentIntentId: parsed.paymentIntentId,
        usuarioId: parsed.userId,
        planId: parsed.planId ? Number(parsed.planId) : undefined,
        monto: stripeAmountToMonto(parsed.amount),
        estado: event.type === "invoice.paid" ? "APROBADO" : "FALLIDO",
        periodEnd: parsed.periodEnd,
        membresiaId: parsed.membershipId ? Number(parsed.membershipId) : undefined,
      });

      if (resultado.estado === "FALLIDO" && !resultado.duplicado) {
        void sendContingencyWebhook({
          evento: "invoice.payment_failed",
          paymentIntentId: parsed.paymentIntentId ?? parsed.invoiceId,
          usuarioId: resultado.usuarioId ?? parsed.userId ?? "unknown",
          reservaId: null,
          membresiaId: resultado.membresiaId ? String(resultado.membresiaId) : null,
          reservaEstado: null,
          franjaRestituida: false,
          monto: stripeAmountToMonto(parsed.amount),
        })
          .then((webhook) => {
            if (!webhook.sent) {
              console.error(
                "Alerta de fallo de cobro de suscripción no enviada a n8n:",
                webhook.error,
              );
            }
          })
          .catch((err) => {
            console.error("Error al despachar alerta de suscripción fallida a n8n:", err);
          });
      }

      if (resultado.usuarioId && resultado.estado === "APROBADO") {
        clearPendingSubscriptionCheckout(resultado.usuarioId);
      }

      return ok({ received: true, ...resultado });
    } catch (error: unknown) {
      if (error instanceof PaymentError) {
        return fail(error.code, error.message, error.status);
      }
      console.error("Error en POST /api/payments (factura Stripe):", error);
      return fail("SERVER_ERROR", "Error al procesar la factura de Stripe.", 500);
    }
  }

  const intent = event.data.object as Stripe.PaymentIntent;
  const {
    userId,
    bookingId,
    bookingIds,
    membershipId,
    vendedorId,
    serviceId,
  } = parsePaymentIntentMetadata(intent.metadata);
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
  const hasPosMetadata = vendedorId !== undefined || serviceId !== undefined;
  if (
    hasPosMetadata &&
    (!vendedorId || serviceId === undefined || effectiveBookingIds.length !== 1)
  ) {
    return fail(
      "INVALID_POS_METADATA",
      "El cobro POS requiere vendedor, servicio y una única reserva válidos.",
      400,
    );
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
      // UUIDv4 no predecible para el TICKET_QR (TSK-BE-11), generado en core.
      ticketCodigoUuid: newTicketId(),
      ...(hasPosMetadata ? { vendedorId, serviceId } : {}),
    });
    // Observación de @Its-JrDev: solo notificar a n8n si el pago falló Y NO es un reintento duplicado.
    if (resultado.estado === "FALLIDO" && !resultado.duplicado) {
      // RF-09: alerta de pago fallido. Fire-and-forget: no bloquea la respuesta
      // a Stripe ni revierte la cancelación de la reserva ya aplicada.
      void sendContingencyWebhook({
        evento: "payment_intent.payment_failed",
        paymentIntentId: intent.id,
        usuarioId: userId,
        reservaId: effectiveBookingIds[0] ?? bookingId ?? null,
        membresiaId: membershipId ?? null,
        reservaEstado: resultado.reservaEstado,
        franjaRestituida: resultado.franjaRestituida,
        monto: stripeAmountToMonto(intent.amount ?? 0),
      })
        .then((webhook) => {
          if (!webhook.sent) {
            console.error(
              "Alerta de pago fallido no enviada a n8n:",
              webhook.error,
            );
          }
        })
        .catch((err) => {
          console.error("Error al despachar alerta de pago fallido a n8n:", err);
        });
    }
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
