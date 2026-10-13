export const TICKET_QR_PREFIX = "SC1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRMA_RE = /^[0-9a-f]{64}$/i;

export interface ParsedTicketQr {
  ticketId: string;
  signature: string;
}

/**
 * Parsea el contenido de un código QR en el cliente de manera segura y sin dependencias de node:crypto.
 * Soporta:
 * 1. Formato oficial de comprobante: SC1:<uuid>:<firma-hmac-sha256>
 * 2. Formato JSON: {"ticketId":"...","signature":"..."}
 * 3. Formato separado por espacios o barra vertical: <uuid> | <firma>
 */
export function parseTicketQr(text: string): ParsedTicketQr | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  // 1. Formato oficial SC1:<uuid>:<firma>
  const parts = trimmed.split(":");
  if (parts.length === 3 && parts[0] === TICKET_QR_PREFIX) {
    const [, ticketId, signature] = parts;
    if (UUID_RE.test(ticketId) && FIRMA_RE.test(signature)) {
      return { ticketId, signature };
    }
  }

  // 2. Formato JSON
  try {
    const json = JSON.parse(trimmed);
    if (
      json &&
      typeof json.ticketId === "string" &&
      typeof json.signature === "string" &&
      UUID_RE.test(json.ticketId) &&
      FIRMA_RE.test(json.signature)
    ) {
      return { ticketId: json.ticketId, signature: json.signature };
    }
  } catch {
    // Continuar si no es JSON válido
  }

  // 3. Formato separado por espacios o barras verticales
  const tokens = trimmed.split(/[|\s]+/);
  if (tokens.length === 2 && UUID_RE.test(tokens[0]) && FIRMA_RE.test(tokens[1])) {
    return { ticketId: tokens[0], signature: tokens[1] };
  }

  return null;
}
