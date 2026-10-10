// RN-06 ventana [HoraInicio, HoraFin] + RN-05 ciclo EMITIDO→USADO + puesto/consulta (RF-13/RF-14)

export type AccessDecision =
  | { allowed: true; consume: boolean }
  | { allowed: false; code: "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "ALREADY_USED" | "INVALID_STATE" };

export type BotTicketValidationReason =
  | "RESERVATION_CANCELLED"
  | "RESERVATION_NOT_CONFIRMED"
  | "SERVICE_INACTIVE"
  | "ALREADY_USED"
  | "WINDOW_EXPIRED";

export function validateBotTicket(opts: {
  now: Date;
  start: Date;
  end: Date;
  ticketStatus: "EMITIDO" | "USADO";
  reservationStatus: string;
  serviceStatus: string;
}): { valid: true } | { valid: false; reason: BotTicketValidationReason } {
  if (opts.reservationStatus === "CANCELADA_ADMINISTRATIVA") {
    return { valid: false, reason: "RESERVATION_CANCELLED" };
  }
  if (opts.reservationStatus !== "CONFIRMADA") {
    return { valid: false, reason: "RESERVATION_NOT_CONFIRMED" };
  }
  if (opts.serviceStatus !== "ACTIVO") {
    return { valid: false, reason: "SERVICE_INACTIVE" };
  }
  if (opts.ticketStatus !== "EMITIDO") {
    return { valid: false, reason: "ALREADY_USED" };
  }
  if (opts.now < opts.start || opts.now > opts.end) {
    return { valid: false, reason: "WINDOW_EXPIRED" };
  }
  return { valid: true };
}

export function decideAccess(opts: {
  now: Date;
  start: Date;
  end: Date;
  ticketStatus: "EMITIDO" | "USADO";
  ticketServiceId: string;
  postServiceId: string | null; // null = modo consulta
}): AccessDecision {
  if (opts.postServiceId === null) {
    // Modo consulta: informativo, nunca consume (RN-05)
    return { allowed: true, consume: false };
  }
  if (opts.ticketServiceId !== opts.postServiceId) return { allowed: false, code: "SERVICE_MISMATCH" };
  if (opts.ticketStatus !== "EMITIDO") return { allowed: false, code: "ALREADY_USED" };
  if (opts.now < opts.start || opts.now > opts.end) return { allowed: false, code: "WINDOW_EXPIRED" };
  return { allowed: true, consume: true };
}
