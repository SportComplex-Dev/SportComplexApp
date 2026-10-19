import {
  ACCESS_ALREADY_USED_MESSAGE,
  ACCESS_WINDOW_EXPIRED_MESSAGE,
  decideAccess,
  hasServiceMismatch,
  getTicketAccessWindow,
} from "@sportcomplex/core";
import { verifyTicketSignature } from "@sportcomplex/security";
import {
  ejecutarLectura,
  getAsignacionVigente,
  getServicioParaAccesoById,
  getTicketForScan,
  TicketError,
  type ClienteDb,
  type ModoLecturaValor,
  type ResultadoLecturaValor,
} from "@sportcomplex/db";

export { getTicketAccessWindow, ACCESS_WINDOW_EXPIRED_MESSAGE };

// TSK-BD-10 — orquestador del escáner (RF-13/RF-14/RF-15 · RN-05).
// Orden fijo: cargar ticket para obtener su ventana confiable → validar firma
// HMAC (incluido el rango de tickets consolidados) → decidir acceso → canje
// y auditoría en una transacción.
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
  db?: ClienteDb;
}

export interface EscaneoResultado {
  access: "GRANTED" | "DENIED";
  /** Presente solo cuando `access === "DENIED"`. */
  code?: AccessDeniedCode;
  /** Mensaje explicativo de la denegación (ej. RF-15 "Acceso denegado: Franja horaria vencida"). */
  message?: string;
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

export async function procesarEscaneo(
  input: EscaneoInput,
  options: EscaneoOptions,
): Promise<EscaneoResultado> {
  // Trade-off TSK-BE-31: las firmas legacy se pueden prevalidar antes de DB,
  // pero los tickets consolidados firman la ventana almacenada en la fila.
  // Para distinguir ambos formatos compatibles, se carga la fila y luego se
  // valida el HMAC. La ruta exige credenciales del lector; no se escribe ni
  // registra una lectura hasta que la firma queda validada.
  const now = options.now ?? new Date();
  const db = options.db;
  const legacySignatureValid = verifyTicketSignature(input.ticketId, input.signature, options.qrSecret);
  let ticket;
  try {
    ticket = await getTicketForScan(input.ticketId, db);
  } catch (error) {
    if (error instanceof TicketError && !legacySignatureValid) {
      throw new AccessError("Firma del QR inválida.", "INVALID_SIGNATURE", 400);
    }
    throw error;
  }
  const signedWindow = ticket.inicioValidez && ticket.finValidez
    ? { start: ticket.inicioValidez, end: ticket.finValidez }
    : undefined;
  if (!verifyTicketSignature(input.ticketId, input.signature, options.qrSecret, signedWindow)) {
    throw new AccessError("Firma del QR inválida.", "INVALID_SIGNATURE", 400);
  }

  const ticketServiceId = ticket.reserva.disponibilidad.servicio.id;
  const ticketServiceName = ticket.reserva.disponibilidad.servicio.nombre;
  const serviceMismatch = hasServiceMismatch(ticketServiceId, input.postServiceId);
  const stationService = serviceMismatch && input.postServiceId !== null
    ? await getServicioParaAccesoById(input.postServiceId, db)
    : null;
  if (serviceMismatch && !stationService) {
    throw new AccessError("El servicio del puesto no existe.", "SERVICE_NOT_FOUND", 404);
  }
  const serviceMismatchMessage = stationService
    ? `Acceso denegado: El tiquete pertenece a ${ticketServiceName} y se encuentra en ${stationService.nombre}`
    : undefined;

  const { start, end } = signedWindow
    ? { start: new Date(signedWindow.start), end: new Date(signedWindow.end) }
    : getTicketAccessWindow(ticket.reserva.disponibilidad);
  const decision = decideAccess({
    now,
    start,
    end,
    ticketStatus: ticket.estado,
    ticketServiceId,
    postServiceId: input.postServiceId,
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

  let message: string | undefined;
  if (access === "DENIED") {
    if (!decision.allowed && decision.code === "SERVICE_MISMATCH") {
      message = serviceMismatchMessage ?? decision.message ?? ACCESS_ALREADY_USED_MESSAGE;
    } else if (!decision.allowed) {
      message = decision.message ?? ACCESS_ALREADY_USED_MESSAGE;
    } else {
      message = ACCESS_ALREADY_USED_MESSAGE;
    }
  }

  return {
    access,
    ...(access === "DENIED" && !decision.allowed ? { code: decision.code } : {}),
    ...(access === "DENIED" && decision.allowed ? { code: "ALREADY_USED" as const } : {}),
    ...(message ? { message } : {}),
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
      fecha: start.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
      horaInicio: new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(start),
      horaFin: new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(end),
      titularId: ticket.reserva.titular.id,
      titularNombre: ticket.reserva.titular.nombre,
    },
  };
}
