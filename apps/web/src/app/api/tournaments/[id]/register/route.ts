import { created, fail } from '@sportcomplex/shared/lib';
import { authorizeApiRequest } from "@/lib/api/api-auth";
import {
  registerTournamentSchema,
  tournamentIdParamSchema,
} from "@sportcomplex/validation";
import {
  inscribirUsuarioTorneo,
  obtenerDetallePublicoTorneo,
  verificarPagoParaTorneo,
  TournamentError,
} from "@sportcomplex/db";
import { buildTicketQrPayload, signTicket } from "@sportcomplex/core";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tournaments/[id]/register
 * Inscribe a un socio/cliente en un torneo deportivo con control atómico de cupos,
 * prevención de inscripciones duplicadas, resolución de pago y emisión de QR seguro (TSK-BE-26 / SCRUM-167).
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const qrSecret = process.env.QR_HMAC_SECRET;
    if (!qrSecret) {
      return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET en el servidor.", 503);
    }

    const authorization = await authorizeApiRequest(["Cliente", "Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const parsedId = tournamentIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return fail("INVALID_ID", "El ID del torneo debe ser un UUID válido.", 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    if (typeof rawBody !== "object" || rawBody === null) {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un objeto JSON", 400);
    }

    const parsed = registerTournamentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de inscripción inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      // 1. Validar torneo y condiciones de costo (MED-05: proyección liviana sin over-fetching de inscripciones)
      const torneo = await obtenerDetallePublicoTorneo(parsedId.data);
      const precio = Number(torneo.precioInscripcion ?? 0);
      const esGratuito = precio === 0;

      let confirmado = false;
      let pagoIdValido: string | null = null;
      const paymentRef = parsed.data.pagoId || parsed.data.stripePaymentIntentId || null;

      if (esGratuito) {
        confirmado = true;
      } else if (paymentRef) {
        const pago = await verificarPagoParaTorneo(
          paymentRef,
          authorization.actor.id,
          precio,
          torneo.id,
        );
        if (!pago) {
          return fail(
            "PAYMENT_INVALID",
            "El identificador de pago no es válido, no está aprobado o no cubre el monto requerido.",
            400,
          );
        }
        confirmado = true;
        pagoIdValido = pago.id;
      }

      // 2. Transacción atómica de inscripción y control de cupos (ARC-01)
      const inscripcion = await inscribirUsuarioTorneo({
        torneoId: parsedId.data,
        usuarioId: authorization.actor.id,
        nombrePareja: parsed.data.nombrePareja,
        pagoId: pagoIdValido,
        confirmado,
      });

      // 3. Emisión criptográfica de entrada QR con firma HMAC-SHA256 (RNF-03 / RF-13)
      let ticketData = null;
      if (inscripcion.ticketCodigoUuid && inscripcion.estado === "CONFIRMADA") {
        const signature = signTicket(inscripcion.ticketCodigoUuid, qrSecret);
        const qrPayload = buildTicketQrPayload(inscripcion.ticketCodigoUuid, signature);

        ticketData = {
          codigoUuid: inscripcion.ticketCodigoUuid,
          estado: inscripcion.ticketEstado,
          firma: signature,
          qrPayload,
        };
      }

      return created({
        inscripcion,
        ticket: ticketData,
        requierePago: inscripcion.estado === "PENDIENTE_PAGO",
        precioInscripcion: precio,
      });
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error en POST /api/tournaments/[id]/register:", error);
    return fail("SERVER_ERROR", "Error al procesar la inscripción al torneo", 500);
  }
}
