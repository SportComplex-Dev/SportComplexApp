import { authorizeApiRequest } from "@/lib/api/api-auth";
import { prisma, findActiveMembership } from "@sportcomplex/db";
import { createStripeSubscriptionCheckoutSession, type StripeCheckoutClient } from "@sportcomplex/core";
import { created, fail } from '@sportcomplex/shared/lib';
import { z } from "zod";

const subscribeSchema = z.object({
  planId: z.coerce.number().int().positive(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

interface PendingCheckoutRecord {
  sessionId: string;
  url: string | null;
  planId: number;
  planNombre: string;
  periodicidad: string;
  precio: unknown;
  expiresAt: number; // Unix ms
}

const pendingSubscriptionsByUser = new Map<string, PendingCheckoutRecord>();

/**
 * Limpia la sesión de suscripción pendiente (ej. tras activación en webhook o en pruebas).
 */
export function clearPendingSubscriptionCheckout(userId: string) {
  pendingSubscriptionsByUser.delete(userId);
}

/**
 * POST /api/memberships/subscribe
 * Inicia la suscripción recurrente en Stripe Checkout (RF-16 / RN-09).
 * Valida que el cliente no posea ya una membresía VIGENTE (TSK-BD-11).
 * Es idempotente ante reintentos y bloquea la creación de Checkouts simultáneos pendientes.
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Cliente"]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de suscripción inválidos.", 400, parsed.error.flatten());
    }

    const userId = authorization.actor.id;

    // Regla crítica: Una persona no puede tener dos membresías VIGENTES (TSK-BD-11 / RF-16)
    const vigente = await findActiveMembership(userId);
    if (vigente) {
      pendingSubscriptionsByUser.delete(userId);
      return fail(
        "DUPLICATE_ACTIVE_MEMBERSHIP",
        "El usuario ya cuenta con una membresía vigente activa.",
        409,
      );
    }

    const now = Date.now();
    const existingPending = pendingSubscriptionsByUser.get(userId);
    if (existingPending && existingPending.expiresAt <= now) {
      pendingSubscriptionsByUser.delete(userId);
    } else if (existingPending && existingPending.expiresAt > now) {
      // Reintento para el mismo plan: devolver de forma idempotente la sesión existente
      if (existingPending.planId === parsed.data.planId) {
        return created({
          plan: {
            id: existingPending.planId,
            nombre: existingPending.planNombre,
            periodicidad: existingPending.periodicidad,
            precio: existingPending.precio,
          },
          checkout: {
            sessionId: existingPending.sessionId,
            url: existingPending.url,
          },
        });
      }

      // Solicitud para otro plan mientras hay una sesión pendiente activa en curso
      return fail(
        "PENDING_SUBSCRIPTION_CHECKOUT",
        "El usuario ya posee una sesión de suscripción pendiente para otro plan.",
        409,
      );
    }

    const plan = await prisma.planMembresia.findUnique({
      where: { id: parsed.data.planId },
    });

    if (!plan || !plan.activo) {
      return fail("PLAN_NOT_FOUND", "El plan de membresía seleccionado no existe o no está activo.", 404);
    }

    if (!plan.stripePriceId || !plan.stripePriceId.trim()) {
      return fail(
        "STRIPE_PRICE_NOT_CONFIGURED",
        "El plan de membresía seleccionado no tiene un ID de precio de Stripe configurado.",
        400,
      );
    }

    const priceId = plan.stripePriceId.trim();
    const headerIdempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;
    const idempotencyKey =
      parsed.data.idempotencyKey?.trim() ||
      headerIdempotencyKey ||
      `sub_checkout_${userId}_${plan.id}`;

    let checkout;
    try {
      const explicitClient = (globalThis as unknown as { __scStripeClient?: StripeCheckoutClient }).__scStripeClient;
      checkout = await createStripeSubscriptionCheckoutSession(
        {
          userId,
          planId: plan.id,
          priceId,
          idempotencyKey,
          successUrl: parsed.data.successUrl,
          cancelUrl: parsed.data.cancelUrl,
        },
        explicitClient ? { client: explicitClient } : {},
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("STRIPE_NOT_CONFIGURED")) {
        return fail("STRIPE_NOT_CONFIGURED", "La pasarela de pago no está configurada.", 503);
      }
      console.error("Error iniciando Stripe Subscription Checkout Session:", err);
      return fail("CHECKOUT_STRIPE_FAILED", "No se pudo iniciar la sesión de suscripción.", 502);
    }

    const expiresAtMs = checkout.expiresAt
      ? checkout.expiresAt.getTime()
      : Date.now() + 30 * 60 * 1000;

    pendingSubscriptionsByUser.set(userId, {
      sessionId: checkout.sessionId,
      url: checkout.url,
      planId: plan.id,
      planNombre: plan.nombre,
      periodicidad: plan.periodicidad,
      precio: plan.precio,
      expiresAt: expiresAtMs,
    });

    return created({
      plan: {
        id: plan.id,
        nombre: plan.nombre,
        periodicidad: plan.periodicidad,
        precio: plan.precio,
      },
      checkout: {
        sessionId: checkout.sessionId,
        url: checkout.url,
      },
    });
  } catch (error: unknown) {
    console.error("Error en POST /api/memberships/subscribe:", error);
    return fail("SERVER_ERROR", "Error al procesar la suscripción.", 500);
  }
}
