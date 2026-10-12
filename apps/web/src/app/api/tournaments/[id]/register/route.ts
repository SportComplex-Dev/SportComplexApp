import { created, fail } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import {
  registerTournamentSchema,
  tournamentIdParamSchema,
} from "@sportcomplex/validation";
import {
  inscribirUsuarioTorneo,
  obtenerTorneoPorId,
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
      // 1. Validar torneo y condiciones de costo
      const torneo = await obtenerTorneoPorId(parsedId.data);
      const precio = Number(torneo.precioInscripcion ?? 0);
      const esGratuito = precio === 0;
      const pagoRef = parsed.data.pagoId || parsed.data.stripePaymentIntentId || null;
      const confirmado = esGratuito || Boolean(pagoRef);

      // 2. Transacción atómica de inscripción y control de cupos (ARC-01)
      const inscripcion = await inscribirUsuarioTorneo({
        torneoId: parsedId.data,
        usuarioId: authorization.actor.id,
        nombrePareja: parsed.data.nombrePareja,
        pagoId: pagoRef,
        confirmado,
      });

      // 3. Emisión criptográfica de entrada QR con firma HMAC-SHA256 (RNF-03 / RF-13)
      let ticketData = null;
      if (inscripcion.ticketCodigoUuid && inscripcion.estado === "CONFIRMADA") {
        const qrSecret =
          process.env.QR_HMAC_SECRET ||
          process.env.NEXTAUTH_SECRET ||
          "sportcomplex-secret";
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
