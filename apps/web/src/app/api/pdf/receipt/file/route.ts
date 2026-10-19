import { fail } from '@sportcomplex/shared/lib';
import { ReceiptError } from "@sportcomplex/db";
import { construirTicketComprobante, numeroComprobante, ticketPdf } from "@sportcomplex/printing";
import {
  construirComprobante,
  validarSolicitudComprobante,
} from "@/app/api/pdf/receipt/receipt";
import { authorizeApiRequest } from "@/lib/api/api-auth";

// GET /api/pdf/receipt/file?reservaId=<uuid>&destinatario=PORTAL|POS
//
// PDF de 58 mm del comprobante: el mismo bitmap que la taquilla manda a la
// impresora térmica (@sportcomplex/printing), servido como archivo. Es la
// única salida "impresa" para el cliente (descarga); imprimir en la térmica
// es exclusivo del operador desde /pos.
//
// Reutiliza el orquestador de `GET /api/pdf/receipt`: mismo aislamiento por
// titular y misma regla de que `POS` solo lo emite el personal.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authorization = await authorizeApiRequest([
      "Cliente",
      "Empleado_Vendedor",
      "Administrador",
    ]);
    if (!authorization.authorized) return authorization.response;

    const qrSecret = process.env.QR_HMAC_SECRET;
    if (!qrSecret) {
      return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
    }

    const { searchParams } = new URL(request.url);
    const { reservaId, destinatario } = validarSolicitudComprobante({
      reservaId: searchParams.get("reservaId"),
      destinatario: searchParams.get("destinatario"),
    });

    const comprobante = await construirComprobante(reservaId, {
      solicitante: {
        userId: authorization.actor.id,
        role: authorization.actor.role,
        destinatario,
      },
      qrSecret,
      // El PDF dibuja el QR en el bitmap; el PNG del DTO no se usa.
      generarQrDataUrl: async () => "",
    });

    const pdf = ticketPdf(construirTicketComprobante(comprobante));
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ticket-${numeroComprobante(reservaId)}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof ReceiptError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/pdf/receipt/file:", error);
    return fail("SERVER_ERROR", "Error al generar el PDF del comprobante.", 500);
  }
}
