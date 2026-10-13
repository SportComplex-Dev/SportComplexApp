import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/auth";
import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";
import { buildPaymentMetadata, STRIPE_CURRENCY } from "@sportcomplex/core";
import { prisma } from "@sportcomplex/db";

const requestSchema = z.object({
  reservationId: z.string().uuid().optional(),
  reservaId: z.string().uuid().optional(),
}).refine((data) => data.reservationId || data.reservaId, {
  message: "El identificador de la reserva no es válido.",
});

function paymentIntentAmount(total: unknown): number | null {
  const amount = Number(total);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const minorUnits = Math.round(amount * 100);
  return Number.isSafeInteger(minorUnits) ? minorUnits : null;
}

function paymentIntentResponse(paymentIntent: Stripe.PaymentIntent) {
  if (paymentIntent.status === "succeeded" || paymentIntent.status === "processing") {
    return ok({
      clientSecret: null,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  }

  const clientSecret = paymentIntent.client_secret;
  if (!clientSecret) {
    return fail(
      "PAYMENT_NOT_AVAILABLE",
      "El pago no está disponible en este momento. Inténtalo de nuevo más tarde.",
      409,
    );
  }
  return ok({
    clientSecret,
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
  });
}

export async function POST(
  request: Request,
  dependencies: { stripeClient?: Stripe } = {},
) {
  try {
    let userId: string | null = null;
    const authResult = await authorizeApiRequest(["Cliente"]);
    if (authResult.authorized) {
      userId = authResult.actor.id;
    } else {
      try {
        const session = await auth();
        if (
          session?.user?.id &&
          (session.user.role?.toUpperCase() === "CLIENTE" || !session.user.role) &&
          (session.user.estado === "ACTIVO" || !session.user.estado)
        ) {
          userId = session.user.id;
        }
      } catch {
        // En entorno de test sin request store o sin sesión válida de NextAuth
      }
    }

    if (!userId) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión para pagar una reserva.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "El identificador de la reserva no es válido.", 400);
    }
    const targetReservationId = (parsed.data.reservationId || parsed.data.reservaId)!;

    const now = new Date();
    const reservation = await prisma.reserva.findFirst({
      where: {
        id: targetReservationId,
        titularId: userId,
      },
      include: { pago: true },
    });

    if (!reservation) {
      return fail(
        "RESERVATION_NOT_FOUND",
        "La reserva no existe o no pertenece al usuario autenticado.",
        404,
      );
    }

    if (
      reservation.canal !== "ONLINE" ||
      reservation.estado !== "PENDIENTE_PAGO" ||
      !reservation.expiraEn ||
      reservation.expiraEn <= now
    ) {
      return fail(
        "RESERVATION_NOT_PAYABLE",
        "Esta reserva ya no está pendiente de pago o su tiempo de reserva venció.",
        409,
      );
    }

    const amount = paymentIntentAmount(reservation.total);
    if (amount === null) {
      return fail("INVALID_RESERVATION_AMOUNT", "El valor de la reserva no es válido.", 409);
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!dependencies.stripeClient && !secretKey) {
      console.error("STRIPE_SECRET_KEY no está configurada.");
      return fail("PAYMENT_CONFIGURATION_ERROR", "El pago no está disponible en este momento.", 503);
    }

    const stripe = dependencies.stripeClient ?? new Stripe(secretKey!);
    let paymentIntent: Stripe.PaymentIntent;

    if (reservation.pagoId) {
      const payment = reservation.pago;
      if (
        !payment ||
        payment.usuarioId !== userId ||
        payment.tipo !== "RESERVA" ||
        Number(payment.monto) !== Number(reservation.total) ||
        payment.estado !== "PENDIENTE"
      ) {
        return fail("PAYMENT_STATE_CONFLICT", "No se puede iniciar el pago de esta reserva.", 409);
      }

      paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      if (paymentIntent.status === "canceled") {
        return fail(
          "PAYMENT_CANCELED",
          "Este intento de pago fue cancelado. Consulta el estado de tu reserva.",
          409,
        );
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount,
          currency: STRIPE_CURRENCY,
          automatic_payment_methods: { enabled: true },
          metadata: buildPaymentMetadata({
            bookingId: reservation.id,
            userId,
          }),
        },
        { idempotencyKey: `reservation-${reservation.id}` },
      );

      const associated = await prisma.$transaction(async (tx) => {
        const current = await tx.reserva.findFirst({
          where: {
            id: reservation.id,
            titularId: userId!,
            canal: "ONLINE",
            estado: "PENDIENTE_PAGO",
            expiraEn: { gt: new Date() },
          },
          select: { id: true },
        });
        if (!current) return false;

        const payment = await tx.pago.upsert({
          where: { stripePaymentIntentId: paymentIntent.id },
          create: {
            usuarioId: userId!,
            tipo: "RESERVA",
            stripePaymentIntentId: paymentIntent.id,
            monto: reservation.total,
            estado: "PENDIENTE",
          },
          update: {},
        });
        if (payment.usuarioId !== userId || payment.tipo !== "RESERVA") return false;

        const updated = await tx.reserva.updateMany({
          where: {
            id: reservation.id,
            titularId: userId!,
            estado: "PENDIENTE_PAGO",
            expiraEn: { gt: new Date() },
            OR: [{ pagoId: null }, { pagoId: payment.id }],
          },
          data: { pagoId: payment.id },
        });
        return updated.count === 1;
      });

      if (!associated) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id);
        } catch (error: unknown) {
          console.error("No se pudo cancelar un PaymentIntent sin reserva pagable:", error);
        }
        return fail(
          "RESERVATION_NOT_PAYABLE",
          "La reserva venció o cambió de estado. Vuelve a seleccionar el horario.",
          409,
        );
      }
    }

    return paymentIntentResponse(paymentIntent);
  } catch (error: unknown) {
    console.error("Error al crear el PaymentIntent de una reserva:", error);
    if (error instanceof Stripe.errors.StripeError) {
      return fail(
        "PAYMENT_PROVIDER_ERROR",
        "No pudimos preparar el pago. Inténtalo de nuevo.",
        502,
      );
    }
    return fail("SERVER_ERROR", "Error al preparar el pago de la reserva.", 500);
  }
}
