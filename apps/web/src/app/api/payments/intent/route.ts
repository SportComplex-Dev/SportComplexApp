import { authorizeApiRequest } from "@/lib/api-auth";
import { created, fail } from '@sportcomplex/shared/lib';
import { createPosPaymentIntent } from "@sportcomplex/core";
import { prisma } from "@sportcomplex/db";
import { posPaymentIntentSchema } from "@sportcomplex/validation";

const findReserva = (id: string) => prisma.reserva.findUnique({
  where: { id },
  select: {
    id: true,
    titularId: true,
    vendedorId: true,
    pagoId: true,
    estado: true,
    total: true,
    expiraEn: true,
    disponibilidad: {
      select: {
        servicioId: true,
        servicio: { select: { estado: true } },
      },
    },
  },
});

interface PosReservation {
  id: string;
  titularId: string;
  vendedorId: string | null;
  pagoId: string | null;
  estado: string;
  total: number | string | { toString(): string };
  expiraEn: Date | null;
  disponibilidad: {
    servicioId: number;
    servicio: { estado: string } | null;
  } | null;
}

export function createPaymentIntentPostHandler(
  dependencies: {
    authorize?: typeof authorizeApiRequest;
    findReserva?: (id: string) => Promise<PosReservation | null>;
    createPaymentIntent?: typeof createPosPaymentIntent;
  } = {},
) {
  const authorize = dependencies.authorize ?? authorizeApiRequest;
  const loadReserva = dependencies.findReserva ?? findReserva;
  const createIntent = dependencies.createPaymentIntent ?? createPosPaymentIntent;

  /** Crea el PaymentIntent de una reserva POS; la confirmación final llega por webhook. */
  return async function POST(request: Request) {
    const authorization = await authorize(["Administrador", "Empleado_Vendedor"]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = posPaymentIntentSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de cobro POS inválidos.", 400, parsed.error.flatten());
    }

    try {
      const reserva = await loadReserva(parsed.data.reservaId);

      if (!reserva) return fail("BOOKING_NOT_FOUND", "La reserva no existe.", 404);
      if (
        reserva.estado !== "PENDIENTE_PAGO" ||
        !reserva.expiraEn ||
        reserva.expiraEn <= new Date() ||
        reserva.pagoId
      ) {
        return fail("BOOKING_NOT_PAYABLE", "La reserva no está pendiente o el hold venció.", 409);
      }
      if (reserva.vendedorId && reserva.vendedorId !== authorization.actor.id) {
        return fail("POS_BOOKING_FORBIDDEN", "La reserva ya está asociada a otro vendedor.", 403);
      }
      if (reserva.disponibilidad?.servicio?.estado !== "ACTIVO") {
        return fail("SERVICE_UNAVAILABLE", "El servicio no está activo.", 409);
      }

      const paymentIntent = await createIntent(
        {
          bookingId: reserva.id,
          userId: reserva.titularId,
          serviceId: reserva.disponibilidad.servicioId,
          vendedorId: authorization.actor.id,
          total: reserva.total,
        },
        { idempotencyKey: `sportcomplex-pos-${reserva.id}` },
      );

      return created({
        reservaId: reserva.id,
        paymentIntentId: paymentIntent.paymentIntentId,
        clientSecret: paymentIntent.clientSecret,
        client_secret: paymentIntent.clientSecret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes("STRIPE_NOT_CONFIGURED")) {
        return fail("STRIPE_NOT_CONFIGURED", "La pasarela de pago no está configurada.", 503);
      }
      if (error instanceof Error && error.message.includes("STRIPE_PAYMENT_INTENT")) {
        console.error("Error creando PaymentIntent POS:", error);
        return fail("PAYMENT_INTENT_FAILED", "No se pudo iniciar el cobro POS.", 502);
      }
      if (error instanceof Error && error.message.includes("POS_PAYMENT_INTENT_CONFLICT")) {
        return fail("POS_PAYMENT_INTENT_CONFLICT", "La reserva ya tiene un intento de pago asociado a otro vendedor.", 409);
      }
      if (error instanceof Error && error.message.includes("INVALID_CHECKOUT_AMOUNT")) {
        return fail("INVALID_RESERVATION_TOTAL", "El total de la reserva no puede cobrarse.", 422);
      }
      console.error("Error en POST /api/payments/intent:", error);
      return fail("SERVER_ERROR", "Error al iniciar el cobro POS.", 500);
    }
  };
}

export const POST = createPaymentIntentPostHandler();
