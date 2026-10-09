import { validateBotTicket, verifyTicketSignature } from "@sportcomplex/core";
import { getTicketForScan, TicketError } from "@sportcomplex/db";
import { botTicketQuerySchema } from "@sportcomplex/validation";
import { fail, ok } from "@/lib/api-response";
import { authorizeBotApiKey } from "@/lib/bot-api-auth";
import { getTicketAccessWindow } from "@/lib/access";

export async function handleBotTicketValidation(request: Request, now = new Date()) {
  const unauthorized = authorizeBotApiKey(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const parsed = botTicketQuerySchema.safeParse({
    ticketId: searchParams.get("ticketId"),
    signature: searchParams.get("signature"),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Identificador o firma del ticket inválidos.", 400, parsed.error.flatten());
  }

  const qrSecret = process.env.QR_HMAC_SECRET;
  if (!qrSecret) {
    return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
  }
  if (!verifyTicketSignature(parsed.data.ticketId, parsed.data.signature, qrSecret)) {
    return fail("INVALID_SIGNATURE", "Firma del QR inválida.", 400);
  }

  try {
    const ticket = await getTicketForScan(parsed.data.ticketId);
    const { start, end } = getTicketAccessWindow(ticket.reserva.disponibilidad);
    const validation = validateBotTicket({
      now,
      start,
      end,
      ticketStatus: ticket.estado,
      reservationStatus: ticket.reserva.estado,
      serviceStatus: ticket.reserva.disponibilidad.servicio.estado,
    });

    return ok({
      ticketId: ticket.codigoUuid,
      estado: ticket.estado,
      valido: validation.valid,
      ...(validation.valid ? {} : { motivo: validation.reason }),
      servicio: {
        id: ticket.reserva.disponibilidad.servicio.id,
        nombre: ticket.reserva.disponibilidad.servicio.nombre,
      },
      fecha: ticket.reserva.disponibilidad.fecha.toISOString().slice(0, 10),
      horaInicio: ticket.reserva.disponibilidad.franja.horaInicio.toISOString().slice(11, 19),
      horaFin: ticket.reserva.disponibilidad.franja.horaFin.toISOString().slice(11, 19),
    });
  } catch (error: unknown) {
    if (error instanceof TicketError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/v1/bot/validate-ticket:", error);
    return fail("SERVER_ERROR", "Error al validar el ticket.", 500);
  }
}

export async function GET(request: Request) {
  return handleBotTicketValidation(request);
}
