import ky from "ky";

/**
 * Parámetros de entrada para el despacho del correo de verificación de cuenta.
 */
export interface VerificationCodeEmailParams {
  /** Identificador único del usuario en base de datos (UUID). */
  usuarioId?: string;
  /** Destinatario del correo. */
  to: string;
  /** Nombre del usuario (personalización de plantilla HTML). */
  nombre: string;
  /** Código de 6 dígitos en claro (solo existe en memoria del proceso). */
  code: string;
  /** Fecha de expiración del token. */
  expiraEn: Date;
}

/**
 * Contrato del Payload HTTP POST enviado al webhook de n8n (TSK-AU-01).
 *
 * Formato en camelCase: `usuarioId`, `correo`, `nombre`, `codigoVerificacion`, `expiraEnMinutos`.
 */
export interface VerificationCodeWebhookPayload {
  usuarioId?: string;
  correo: string;
  nombre: string;
  codigoVerificacion: string;
  expiraEnMinutos: number;
}

/**
 * Despacha el código de verificación al webhook n8n de correo (TSK-AU-01).
 *
 * Disparo no bloqueante — fallos no revierten DB (RN-12, ARCHITECTURE §9.4).
 * Si `N8N_AUTH_EMAIL_WEBHOOK_URL` no está configurada, no hace nada.
 *
 * @param {VerificationCodeEmailParams} params - Datos del destinatario, código, expiración y usuario.
 * @returns {Promise<void>} Se resuelve siempre; los fallos solo se registran en logs.
 */
export async function sendVerificationCodeEmail(params: VerificationCodeEmailParams): Promise<void> {
  const url = process.env.N8N_AUTH_EMAIL_WEBHOOK_URL;
  if (!url) return;

  const expiraEnMs = params.expiraEn.getTime() - Date.now();
  const expiraEnMinutos = Math.max(1, Math.round(expiraEnMs / (60 * 1000)));

  const payload: VerificationCodeWebhookPayload = {
    usuarioId: params.usuarioId,
    correo: params.to,
    nombre: params.nombre,
    codigoVerificacion: params.code,
    expiraEnMinutos: expiraEnMinutos,
  };

  try {
    await ky.post(url, {
      json: payload,
      timeout: 2500,
      retry: 0,
    });
  } catch (error) {
    // fire-and-forget: se registra en logs, el usuario puede reenviar código
    console.warn("[email] verification code dispatch failed (non-blocking):", error instanceof Error ? error.message : error);
  }
}
