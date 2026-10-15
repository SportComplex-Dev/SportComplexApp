import type Stripe from "stripe";

export type StripeCurrency = "cop";

export type StripePaymentMetadata = Record<string, string> & {
  bookingId?: string;
  userId: string;
  membershipId?: string;
  servicio_id?: string;
  vendedor_id?: string;
  cashless: string;
};

export interface BuildPaymentMetadataOptions {
  bookingId?: string;
  userId: string;
  membershipId?: string;
  serviceId?: number;
  vendedorId?: string;
}

export interface ParsedPaymentIntentMetadata {
  userId?: string | undefined;
  bookingId?: string | undefined;
  bookingIds: string[];
  membershipId?: string | undefined;
  vendedorId?: string | undefined;
  serviceId?: number | undefined;
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
    retrieve?(id: string, options?: unknown): Promise<Stripe.PaymentIntent>;
  };
}

export interface PosPaymentIntentResult {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
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

export interface StripeCheckoutClient {
  checkout: {
    sessions: {
      create(params: unknown, options?: unknown): Promise<Stripe.Checkout.Session>;
      expire?(id: string, options?: unknown): Promise<Stripe.Checkout.Session>;
    };
  };
  subscriptions?: {
    create(params: unknown, options?: unknown): Promise<Stripe.Subscription>;
    retrieve?(id: string, options?: unknown): Promise<Stripe.Subscription>;
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

export interface CreatePaymentIntentOptions {
  client?: StripePaymentIntentClient;
  idempotencyKey?: string;
}

export interface CreateCheckoutSessionOptions {
  client?: StripeCheckoutClient;
  appUrl?: string;
}
