import { validateBotTicket } from "@sportcomplex/core";
import { getTicketForScan, TicketError } from "@sportcomplex/db";
import { verifyTicketSignature } from "@sportcomplex/security";
import { botTicketQuerySchema } from "@sportcomplex/validation";
import { fail, ok } from '@sportcomplex/shared/lib';
import { authorizeBotApiKey } from "@/lib/api/bot-api-auth";
import { getTicketAccessWindow } from "@/lib/api/access";

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
  try {
    const ticket = await getTicketForScan(parsed.data.ticketId);
    const signedWindow = ticket.inicioValidez && ticket.finValidez
      ? { start: ticket.inicioValidez, end: ticket.finValidez }
      : undefined;
    if (!verifyTicketSignature(parsed.data.ticketId, parsed.data.signature, qrSecret, signedWindow)) {
      return fail("INVALID_SIGNATURE", "Firma del QR inválida.", 400);
    }
    const { start, end } = signedWindow ?? getTicketAccessWindow(ticket.reserva.disponibilidad);
    const date = start.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const time = (instant: Date) => new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(instant);
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
      fecha: date,
      horaInicio: time(start),
      horaFin: time(end),
    });
  } catch (error: unknown) {
    if (error instanceof TicketError) {
      // Los tickets con ventana requieren leer la fila antes de verificar la
      // firma. Para un UUID inexistente, no exponer si el boleto existe:
      // conserva la respuesta genérica cuando no es una firma legacy válida.
      if (error.code === "TICKET_NOT_FOUND" && !verifyTicketSignature(
        parsed.data.ticketId,
        parsed.data.signature,
        qrSecret,
      )) {
        return fail("INVALID_SIGNATURE", "Firma del QR inválida.", 400);
      }
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/v1/bot/validate-ticket:", error);
    return fail("SERVER_ERROR", "Error al validar el ticket.", 500);
  }
}

export async function GET(request: Request) {
  return handleBotTicketValidation(request);
}
