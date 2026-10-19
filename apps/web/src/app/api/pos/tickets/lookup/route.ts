import { fail, ok } from '@sportcomplex/shared/lib';
import { isValidTicketId, parseTicketQrPayload, verifyTicketSignature } from "@sportcomplex/core";
import { findReservaIdParaReimpresion } from "@sportcomplex/db";
import { ticketReprintLookupSchema } from "@sportcomplex/validation";
import { authorizeApiRequest } from "@/lib/api/api-auth";

// GET /api/pos/tickets/lookup?codigo=<QR | uuid>
//
// Reimpresión en taquilla: el cliente reservó online y pide su ticket en
// papel. El operador lee el QR del pase (o escribe el UUID) y aquí se resuelve
// la reserva; luego el POS pide `GET /api/pdf/receipt?destinatario=POS` y lo
// imprime. Solo Vendedor/Administrador (prefijo /api/pos en el proxy).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Empleado_Vendedor", "Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const parsed = ticketReprintLookupSchema.safeParse({
      codigo: new URL(request.url).searchParams.get("codigo") ?? "",
    });
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Código inválido.", 400);
    }

    let codigo = parsed.data.codigo;
    const qr = parseTicketQrPayload(codigo);
    if (qr) {
      const qrSecret = process.env.QR_HMAC_SECRET;
      if (!qrSecret) return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
      if (!verifyTicketSignature(qr.ticketId, qr.signature.toLowerCase(), qrSecret)) {
        return fail("INVALID_SIGNATURE", "El QR no es un pase válido de Akros Latam.", 400);
      }
      codigo = qr.ticketId;
    } else if (!isValidTicketId(codigo)) {
      return fail("VALIDATION_ERROR", "Escanee el QR del pase o escriba su UUID.", 400);
    }

    const reservaId = await findReservaIdParaReimpresion(codigo.toLowerCase());
    if (!reservaId) return fail("NOT_FOUND", "No hay ninguna reserva con ese código.", 404);
    return ok({ reservaId }, { "Cache-Control": "no-store" });
  } catch (error: unknown) {
    console.error("Error en GET /api/pos/tickets/lookup:", error);
    return fail("SERVER_ERROR", "Error al buscar la reserva.", 500);
  }
}
