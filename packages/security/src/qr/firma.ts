import { createHmac, randomUUID } from "node:crypto";

export interface TicketAccessWindow {
  start: Date | string;
  end: Date | string;
}

/** RNF-03 + ARCHITECTURE §8.2: QR = UUIDv4 + HMAC-SHA256 servidor. */
export function newTicketId(): string {
  return randomUUID();
}

function ticketSigningValue(ticketId: string, window?: TicketAccessWindow): string {
  if (!window) return ticketId;
  const start = new Date(window.start);
  const end = new Date(window.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("La ventana de acceso del ticket no es válida.");
  }
  return `${ticketId}|${start.toISOString()}|${end.toISOString()}`;
}

export function signTicket(ticketId: string, secret: string, window?: TicketAccessWindow): string {
  return createHmac("sha256", secret).update(ticketSigningValue(ticketId, window)).digest("hex");
}

export function verifyTicketSignature(
  ticketId: string,
  signature: string,
  secret: string,
  window?: TicketAccessWindow,
): boolean {
  let expected: string;
  try {
    expected = signTicket(ticketId, secret, window);
  } catch {
    return false;
  }
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
