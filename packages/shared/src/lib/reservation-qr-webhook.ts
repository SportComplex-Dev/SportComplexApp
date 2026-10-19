import { createHmac } from "node:crypto";

export interface ReservationQrWebhookPayload {
  reservaId: string;
  ticketId: string;
  correo: string;
  email?: string;
  nombre?: string;
  cancha?: string;
  sede?: string;
  fecha?: string;
  franjaHoraria?: string;
  qrPayload?: string;
  qrImageUrl?: string;
  appUrl?: string;
  usuario?: {
    nombre?: string;
    email?: string;
  };
  detalle?: {
    servicioNombre?: string;
    fecha?: string;
    horario?: string;
    precioTotal?: string;
    portalUrl?: string;
  };
}

export type ReservationQrWebhookResult =
  | { sent: true }
  | { sent: false; error: string };

/**
 * TSK-BE-34 / TSK-AU-03: Despacha la notificación transaccional con comprobante
 * y QR hacia el webhook de n8n (`reservas/despacho-qr`).
 *
 * Características:
 * - Timeout estricto de 2.5s para no degradar el webhook de pagos.
 * - Firma HMAC opcional si `N8N_RESERVATION_QR_HMAC_SECRET` está configurada.
 * - Desacoplado de fallos: devuelve { sent, error } sin lanzar excepciones.
 */
export async function sendReservationQrWebhook(
  payload: ReservationQrWebhookPayload,
): Promise<ReservationQrWebhookResult> {
  const url = process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  if (!url) {
    return {
      sent: false,
      error: "N8N_RESERVATION_QR_WEBHOOK_URL no está configurada.",
    };
  }

  const secret = process.env.N8N_RESERVATION_QR_HMAC_SECRET;
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret && secret.length >= 32) {
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    headers["X-SportComplex-Signature"] = `sha256=${signature}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(2500),
    });

    if (!response.ok) {
      return {
        sent: false,
        error: `n8n respondió con HTTP ${response.status}.`,
      };
    }

    return { sent: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Error de red no identificado.";
    return {
      sent: false,
      error: `No se pudo contactar n8n para despacho de QR: ${message}`,
    };
  }
}
