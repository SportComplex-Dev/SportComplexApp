import { createHmac, randomUUID } from "node:crypto";

// RNF-03 + ARCHITECTURE §8.2: QR = UUIDv4 + HMAC-SHA256 servidor. Validar firma antes de DB.
export function newTicketId(): string {
  return randomUUID();
}

export function signTicket(ticketId: string, secret: string): string {
  return createHmac("sha256", secret).update(ticketId).digest("hex");
}

export function verifyTicketSignature(ticketId: string, signature: string, secret: string): boolean {
  const expected = signTicket(ticketId, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// TSK-BE-19 — contenido del QR del comprobante: `SC1:<uuid>:<firma>`.
// El ID y la firma viajan JUNTOS en el QR porque el escáner (RF-13) solo
// necesita leer una vez; el par se separa aquí y se valida en el servidor
// (`verifyTicketSignature`) antes de tocar la base de datos.
export const TICKET_QR_PREFIX = "SC1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_RE = /^[0-9a-f]{64}$/i;

export function isValidTicketId(ticketId: string): boolean {
  return UUID_RE.test(ticketId);
}

/** Serializa el par (identificador, firma) que se codifica en el QR. */
export function buildTicketQrPayload(ticketId: string, signature: string): string {
  if (!isValidTicketId(ticketId)) {
    throw new Error("El identificador del ticket debe ser un UUID.");
  }
  if (!FIRMA_RE.test(signature)) {
    throw new Error("La firma del ticket debe ser un HMAC-SHA256 en hexadecimal.");
  }
  return `${TICKET_QR_PREFIX}:${ticketId}:${signature}`;
}

/**
 * Separa el contenido del QR. Devuelve `null` si el texto no cumple el
 * contrato (prefijo desconocido, campos faltantes o malformados): el lector
 * nunca debe lanzar por contenido ajeno, solo rechazarlo.
 */
export function parseTicketQrPayload(text: string): { ticketId: string; signature: string } | null {
  if (typeof text !== "string") return null;
  const partes = text.trim().split(":");
  if (partes.length !== 3) return null;
  const [prefijo, ticketId, signature] = partes;
  if (prefijo !== TICKET_QR_PREFIX) return null;
  if (!isValidTicketId(ticketId) || !FIRMA_RE.test(signature)) return null;
  return { ticketId, signature };
}
