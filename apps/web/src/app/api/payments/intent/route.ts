import Stripe from "stripe";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@sportcomplex/db";
import { buildPaymentMetadata, STRIPE_CURRENCY } from "@sportcomplex/core";
import { fail, ok } from "@/lib/api-response";

const requestSchema = z.object({
  reservationId: z.string().uuid(),
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

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión para pagar una reserva.", 401);
    }
    if (session.user.role?.toUpperCase() !== "CLIENTE" || session.user.estado !== "ACTIVO") {
      return fail("FORBIDDEN", "Solo una cuenta de cliente activa puede pagar en línea.", 403);
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

    const now = new Date();
    const reservation = await prisma.reserva.findFirst({
      where: {
        id: parsed.data.reservationId,
        titularId: userId,
      },
      include: { pago: true },
    });

    if (!reservation) {
      return fail("RESERVATION_NOT_FOUND", "No encontramos esa reserva.", 404);
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
    if (!secretKey) {
      console.error("STRIPE_SECRET_KEY no está configurada.");
      return fail("PAYMENT_CONFIGURATION_ERROR", "El pago no está disponible en este momento.", 503);
    }

    const stripe = new Stripe(secretKey);
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
            titularId: userId,
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
            usuarioId: userId,
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
            titularId: userId,
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
