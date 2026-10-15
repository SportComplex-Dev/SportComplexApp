// TSK-BE-19 — contenido del QR del comprobante: `SC1:<uuid>:<firma>`.
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
  if (!ticketId || !signature) return null;
  if (!isValidTicketId(ticketId) || !FIRMA_RE.test(signature)) return null;
  return { ticketId, signature };
}
