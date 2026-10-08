import { auth } from "@/auth";
import { fail, ok } from "@/lib/api-response";
import {
  construirComprobante,
  validarSolicitudComprobante,
} from "@/lib/receipt";
import { normalizeRole } from "@/lib/session";
import { ReceiptError } from "@sportcomplex/db";

// TSK-BE-19 — GET /api/pdf/receipt?reservaId=<uuid>&destinatario=PORTAL|POS
// RNF-05 · RF-17 · HU-19.
//
// Devuelve la ESTRUCTURA de datos del comprobante (membrete, reserva,
// servicio, titular, QR) ya resuelta en el servidor: el navegador solo la
// maqueta (plantilla `ticket-receipt` de @sportcomplex/ui) y la manda al
// diálogo de impresión de PDF (RN-14). No devuelve PDF binario ni credenciales
// de infraestructura: la firma HMAC del QR y el PNG se generan aquí y
// `QR_HMAC_SECRET` nunca sale del servidor.
//
// Aislamiento (TSK-BE-13 como precedente): el cliente solo ve reservas cuyo
// `titularId` es su usuario; vendedor/administrador pueden emitir en taquilla.
export const runtime = "nodejs";
// Un comprobante refleja el estado actual del boleto: nunca en caché.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión para descargar el comprobante.", 401);
    }
    if (session.user.estado && session.user.estado !== "ACTIVO") {
      return fail("FORBIDDEN", "Tu cuenta no está activa.", 403);
    }

    const qrSecret = process.env.QR_HMAC_SECRET;
    if (!qrSecret) {
      return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
    }

    const { searchParams } = new URL(request.url);
    const { reservaId, destinatario } = validarSolicitudComprobante({
      reservaId: searchParams.get("reservaId"),
      destinatario: searchParams.get("destinatario"),
    });

    const role = normalizeRole(session.user.role);
    const comprobante = await construirComprobante(reservaId, {
      solicitante: { userId: session.user.id, role, destinatario },
      qrSecret,
    });

    return ok(comprobante, { "Cache-Control": "no-store" });
  } catch (error: unknown) {
    if (error instanceof ReceiptError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/pdf/receipt:", error);
    return fail("SERVER_ERROR", "Error al generar los datos del comprobante.", 500);
  }
}