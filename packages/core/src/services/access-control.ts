// RN-06 ventana [HoraInicio, HoraFin] + RN-05 ciclo EMITIDO→USADO + puesto/consulta (RF-13/RF-14/RF-15)

/** Mensaje contractual para RN-06 / RF-15 (criterio clave de aceptación). */
export const ACCESS_WINDOW_EXPIRED_MESSAGE =
  "Acceso denegado: Franja horaria vencida" as const;

export const ACCESS_SERVICE_MISMATCH_MESSAGE =
  "Acceso denegado: El tiquete no corresponde al puesto actual" as const;

export const ACCESS_ALREADY_USED_MESSAGE =
  "Acceso denegado: Tiquete ya utilizado" as const;

/** Compara IDs de servicio usando una única regla en el motor y el orquestador. */
export function hasServiceMismatch(
  ticketServiceId: string | number,
  postServiceId: string | number | null,
): boolean {
  return postServiceId !== null && String(ticketServiceId) !== String(postServiceId);
}

export type AccessDecision =
  | { allowed: true; consume: boolean }
  | {
      allowed: false;
      code: "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "ALREADY_USED" | "INVALID_STATE";
      message?: string;
    };

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
  if (!isWithinAccessWindow(opts.now, opts.start, opts.end)) {
    return { valid: false, reason: "WINDOW_EXPIRED" };
  }
  return { valid: true };
}

/**
 * RN-06: Valida si el instante `now` cae dentro del intervalo cerrado `[start, end]`.
 * Devuelve `false` de forma segura si cualquier fecha es inválida o si `start > end`.
 */
export function isWithinAccessWindow(now: Date, start: Date, end: Date): boolean {
  if (
    Number.isNaN(now.getTime()) ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.getTime() > end.getTime()
  ) {
    return false;
  }
  return now.getTime() >= start.getTime() && now.getTime() <= end.getTime();
}

function normalizeTimeString(val: Date | string): string {
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) {
      throw new RangeError("Hora de franja inválida");
    }
    return val.toISOString().slice(11, 19);
  }
  if (typeof val === "string") {
    const raw = val.includes("T") ? val.slice(11, 19) : val.trim();
    if (raw.length === 5) return `${raw}:00`;
    return raw.slice(0, 8);
  }
  return String(val);
}

/**
 * Construye la ventana de acceso [start, end] a partir de la fecha y franja de la reserva
 * en la zona horaria legal de Colombia (America/Bogota, UTC-5) (RN-06 / RNF-02).
 */
export function getTicketAccessWindow(disponibilidad: {
  fecha: Date | string;
  franja: { horaInicio: Date | string; horaFin: Date | string };
}): { start: Date; end: Date } {
  let fechaStr: string;
  if (disponibilidad.fecha instanceof Date) {
    if (Number.isNaN(disponibilidad.fecha.getTime())) {
      throw new RangeError("Fecha de reserva inválida");
    }
    fechaStr = disponibilidad.fecha.toISOString().slice(0, 10);
  } else if (typeof disponibilidad.fecha === "string") {
    fechaStr = disponibilidad.fecha.slice(0, 10);
  } else {
    throw new TypeError("Tipo de fecha no compatible");
  }

  const horaInicioStr = normalizeTimeString(disponibilidad.franja.horaInicio);
  const horaFinStr = normalizeTimeString(disponibilidad.franja.horaFin);

  const start = new Date(`${fechaStr}T${horaInicioStr}-05:00`);
  const end = new Date(`${fechaStr}T${horaFinStr}-05:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new RangeError("Ventana de reserva inválida: fecha u hora no reconocidas");
  }

  return { start, end };
}

export function decideAccess(opts: {
  now: Date;
  start: Date;
  end: Date;
  ticketStatus: "EMITIDO" | "USADO";
  ticketServiceId: string | number;
  postServiceId: string | number | null; // null = modo consulta
}): AccessDecision {
  if (opts.postServiceId === null) {
    // Modo consulta: informativo, nunca consume (RN-05)
    return { allowed: true, consume: false };
  }
  if (hasServiceMismatch(opts.ticketServiceId, opts.postServiceId)) {
    return { allowed: false, code: "SERVICE_MISMATCH", message: ACCESS_SERVICE_MISMATCH_MESSAGE };
  }
  if (opts.ticketStatus !== "EMITIDO") {
    return { allowed: false, code: "ALREADY_USED", message: ACCESS_ALREADY_USED_MESSAGE };
  }
  if (!isWithinAccessWindow(opts.now, opts.start, opts.end)) {
    return { allowed: false, code: "WINDOW_EXPIRED", message: ACCESS_WINDOW_EXPIRED_MESSAGE };
  }
  return { allowed: true, consume: true };
}
