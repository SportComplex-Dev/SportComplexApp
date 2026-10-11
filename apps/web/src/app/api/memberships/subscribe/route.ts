import { authorizeApiRequest } from "@/lib/api-auth";
import { prisma, findActiveMembership } from "@sportcomplex/db";
import { createStripeSubscriptionCheckoutSession, type StripeCheckoutClient } from "@sportcomplex/core";
import { created, fail } from "@/lib/api-response";
import { z } from "zod";

const subscribeSchema = z.object({
  planId: z.coerce.number().int().positive(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

/**
 * POST /api/memberships/subscribe
 * Inicia la suscripción recurrente en Stripe Checkout (RF-16 / RN-09).
 * Valida que el cliente no posea ya una membresía VIGENTE (TSK-BD-11).
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
      return fail(
        "DUPLICATE_ACTIVE_MEMBERSHIP",
        "El usuario ya cuenta con una membresía vigente activa.",
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

    let checkout;
    try {
      const explicitClient = (globalThis as unknown as { __scStripeClient?: StripeCheckoutClient }).__scStripeClient;
      checkout = await createStripeSubscriptionCheckoutSession(
        {
          userId,
          planId: plan.id,
          priceId,
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
