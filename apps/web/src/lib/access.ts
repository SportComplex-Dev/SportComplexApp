import { decideAccess, verifyTicketSignature } from "@sportcomplex/core";
import {
  ejecutarLectura,
  getAsignacionVigente,
  getTicketForScan,
  type ModoLecturaValor,
  type ResultadoLecturaValor,
} from "@sportcomplex/db";

// TSK-BD-10 — orquestador del escáner (RF-13/RF-14/RF-15 · RN-05).
// Orden fijo: 1) firma HMAC ANTES de tocar la BD → 2) cargar ticket →
// 3) decideAccess() (core, puro) → 4) ejecutarLectura() en una transacción
// (canje condicional + auditoría obligatoria).
// Vive fuera de la ruta para ser testeable sin sesión/auth.

export type AccessDeniedCode =
  | "SERVICE_MISMATCH"
  | "WINDOW_EXPIRED"
  | "ALREADY_USED"
  | "INVALID_STATE";

export class AccessError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

export interface EscaneoInput {
  /** Contenido del QR = `ticket_qr.codigo_uuid` (UUIDv4). */
  ticketId: string;
  /** HMAC-SHA256 del código con `QR_HMAC_SECRET`. */
  signature: string;
  /** Servicio del puesto seleccionado; `null` = modo consulta. */
  postServiceId: number | null;
}

export interface EscaneoOptions {
  empleadoId: string;
  qrSecret: string;
  now?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export interface EscaneoResultado {
  access: "GRANTED" | "DENIED";
  /** Presente solo cuando `access === "DENIED"`. */
  code?: AccessDeniedCode;
  modo: ModoLecturaValor;
  /** Fila persistida en `LECTURA_ACCESO` (siempre exactamente una). */
  resultado: ResultadoLecturaValor;
  /** true solo si esta corrida transmutó EMITIDO → USADO. */
  canjeado: boolean;
  lecturaId: bigint;
  ticket: {
    id: string;
    reservaId: string;
    estado: "EMITIDO" | "USADO";
    servicioId: number;
    servicioNombre: string;
    /** `YYYY-MM-DD` de la reserva. */
    fecha: string;
    /** `HH:MM:SS` de la franja. */
    horaInicio: string;
    horaFin: string;
    titularId: string;
    titularNombre: string;
  };
}

function deniedCodeToResultado(code: AccessDeniedCode): ResultadoLecturaValor {
  switch (code) {
    case "SERVICE_MISMATCH":
      return "DENEGADO_SERVICIO";
    case "WINDOW_EXPIRED":
      return "DENEGADO_HORARIO";
    default:
      return "DENEGADO_USADO"; // ALREADY_USED / INVALID_STATE
  }
}

/** Ventana [inicio, fin] de la reserva = fecha + franja (patrón de bookings, TZ Bogotá). */
function ventanaDeReserva(disponibilidad: {
  fecha: Date;
  franja: { horaInicio: Date; horaFin: Date };
}): { start: Date; end: Date } {
  const fecha = disponibilidad.fecha.toISOString().slice(0, 10);
  const horaInicio = disponibilidad.franja.horaInicio.toISOString().slice(11, 19);
  const horaFin = disponibilidad.franja.horaFin.toISOString().slice(11, 19);
  return {
    start: new Date(`${fecha}T${horaInicio}-05:00`),
    end: new Date(`${fecha}T${horaFin}-05:00`),
  };
}

export async function procesarEscaneo(
  input: EscaneoInput,
  options: EscaneoOptions,
): Promise<EscaneoResultado> {
  // 1. Firma primero: nunca consultar la BD con un QR adulterado.
  if (!verifyTicketSignature(input.ticketId, input.signature, options.qrSecret)) {
    throw new AccessError("Firma del QR inválida.", "INVALID_SIGNATURE", 400);
  }

  const now = options.now ?? new Date();
  const db = options.db;
  const ticket = await getTicketForScan(input.ticketId, db);

  const { start, end } = ventanaDeReserva(ticket.reserva.disponibilidad);
  const decision = decideAccess({
    now,
    start,
    end,
    ticketStatus: ticket.estado,
    ticketServiceId: String(ticket.reserva.disponibilidad.servicio.id),
    postServiceId: input.postServiceId === null ? null : String(input.postServiceId),
  });

  const modo: ModoLecturaValor = input.postServiceId === null ? "CONSULTA" : "TURNO";
  const consumir = decision.allowed && decision.consume;
  const resultado: ResultadoLecturaValor = decision.allowed
    ? consumir
      ? "CONCEDIDO"
      : "CONSULTA"
    : deniedCodeToResultado(decision.code);

  // Solo TURNO ampara con una asignación; CONSULTA la fuerza a NULL (RF-15).
  const asignacion =
    modo === "TURNO"
      ? await getAsignacionVigente(
          options.empleadoId,
          ticket.reserva.disponibilidad.servicio.id,
          now,
          db,
        )
      : null;

  const salida = await ejecutarLectura({
    ticketId: ticket.id,
    modo,
    resultado,
    consumir,
    empleadoId: options.empleadoId,
    asignacionId: modo === "CONSULTA" ? null : (asignacion?.id ?? null),
    now,
    db,
  });

  // La carrera por el canje (count === 0) convierte un GRANTED en DENIED.
  const access: "GRANTED" | "DENIED" = !decision.allowed
    ? "DENIED"
    : consumir && !salida.canjeado
      ? "DENIED"
      : "GRANTED";

  return {
    access,
    ...(access === "DENIED" && !decision.allowed ? { code: decision.code } : {}),
    ...(access === "DENIED" && decision.allowed ? { code: "ALREADY_USED" as const } : {}),
    modo,
    resultado: salida.resultado,
    canjeado: salida.canjeado,
    lecturaId: salida.lecturaId,
    ticket: {
      id: ticket.id,
      reservaId: ticket.reserva.id,
      estado: salida.ticketEstado,
      servicioId: ticket.reserva.disponibilidad.servicio.id,
      servicioNombre: ticket.reserva.disponibilidad.servicio.nombre,
      fecha: ticket.reserva.disponibilidad.fecha.toISOString().slice(0, 10),
      horaInicio: ticket.reserva.disponibilidad.franja.horaInicio.toISOString().slice(11, 19),
      horaFin: ticket.reserva.disponibilidad.franja.horaFin.toISOString().slice(11, 19),
      titularId: ticket.reserva.titular.id,
      titularNombre: ticket.reserva.titular.nombre,
    },
  };
}
