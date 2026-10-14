import { createHmac, randomUUID } from "node:crypto";

/** RNF-03 + ARCHITECTURE §8.2: QR = UUIDv4 + HMAC-SHA256 servidor. */
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
