import type Stripe from "stripe";
import { getStripeClient, stripeError } from "./cliente.js";

/**
 * Valida y construye un evento de webhook de Stripe a partir de payload crudo y firma.
 */
export function constructStripeEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret?: string,
  client?: Stripe,
): Stripe.Event {
  const secret = webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw stripeError("STRIPE_NOT_CONFIGURED", "Falta STRIPE_WEBHOOK_SECRET.");
  }
  const stripe = client ?? getStripeClient();
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Verifica si una firma de webhook es válida sin lanzar excepciones no controladas.
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret?: string,
  client?: Stripe,
): boolean {
  try {
    constructStripeEvent(payload, signature, webhookSecret, client);
    return true;
  } catch {
    return false;
  }
}

export type WebhookHandlerResult =
  | { received: true; processed: true; type: string; data: unknown }
  | { received: true; ignored: true; reason: string; type?: string };

/**
 * Controlador de eventos webhook de Stripe con filtros y dispatch de handlers.
 */
export async function handleStripeWebhookEvent(
  event: Stripe.Event,
  handlers: {
    onPaymentSucceeded?: (intent: Stripe.PaymentIntent) => Promise<unknown>;
    onPaymentFailed?: (intent: Stripe.PaymentIntent) => Promise<unknown>;
    onInvoicePaid?: (invoice: Stripe.Invoice) => Promise<unknown>;
    onInvoicePaymentFailed?: (invoice: Stripe.Invoice) => Promise<unknown>;
    onUnhandled?: (event: Stripe.Event) => Promise<unknown>;
  } = {},
): Promise<WebhookHandlerResult> {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const res = handlers.onPaymentSucceeded ? await handlers.onPaymentSucceeded(intent) : null;
      return { received: true, processed: true, type: event.type, data: res };
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const res = handlers.onPaymentFailed ? await handlers.onPaymentFailed(intent) : null;
      return { received: true, processed: true, type: event.type, data: res };
    }
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const res = handlers.onInvoicePaid ? await handlers.onInvoicePaid(invoice) : null;
      return { received: true, processed: true, type: event.type, data: res };
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const res = handlers.onInvoicePaymentFailed ? await handlers.onInvoicePaymentFailed(invoice) : null;
      return { received: true, processed: true, type: event.type, data: res };
    }
    default: {
      if (handlers.onUnhandled) {
        const res = await handlers.onUnhandled(event);
        return { received: true, processed: true, type: event.type, data: res };
      }
      return { received: true, ignored: true, reason: "EVENT_TYPE_NOT_HANDLED", type: event.type };
    }
  }
}
