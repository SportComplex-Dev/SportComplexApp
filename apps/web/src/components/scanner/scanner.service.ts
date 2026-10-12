import { ACCESS_WINDOW_EXPIRED_MESSAGE, TIMEZONE } from "@sportcomplex/core";

export interface ExpiredSlotDetails {
  slotStart: string;
  slotEnd: string;
  scannedAt: string;
  windowPosition: "BEFORE" | "AFTER";
  ticketStatus: "EMITIDO";
  minutesFromBoundary: number;
}

export interface TicketValidationResponse {
  isValid: boolean;
  ticketId?: string;
  reservationId?: string;
  userName?: string;
  targetCourtName?: string;
  status: "VALID" | "WRONG_COURT" | "EXPIRED" | "ALREADY_USED" | "INVALID";
  message: string;
  expiredDetails?: ExpiredSlotDetails;
}

interface AccessApiResponse {
  success: boolean;
  data?: {
    access: "GRANTED" | "DENIED";
    code?: "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "ALREADY_USED" | "INVALID_STATE";
    resultado: string;
    ticket: {
      reservaId: string;
      estado: "EMITIDO" | "USADO";
      servicioNombre: string;
      fecha: string;
      horaInicio: string;
      horaFin: string;
      titularNombre: string;
    };
    message?: string;
  };
  error?: { message?: string };
  timestamp?: string;
}

export class ScannerServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScannerServiceError";
  }
}

export function parseTicketQr(value: string): { ticketId: string; signature: string } {
  const separator = value.lastIndexOf(".");
  if (separator < 1 || separator === value.length - 1) {
    throw new ScannerServiceError("El código QR no contiene un ticket y una firma válidos.");
  }

  return {
    ticketId: value.slice(0, separator),
    signature: value.slice(separator + 1),
  };
}

function toBogotaDate(fecha: string, hora: string): Date {
  const [year, month, day] = fecha.slice(0, 10).split("-").map(Number);
  const [hours, minutes, seconds = 0] = hora.split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(localAsUtc));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return new Date(localAsUtc - (representedAsUtc - localAsUtc));
}

function hhmm(value: string): string {
  return value.slice(0, 5);
}

export async function validateTicket(
  ticketId: string,
  signature: string,
  postServiceId: number,
): Promise<TicketValidationResponse> {
  let response: Response;
  try {
    response = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, signature, postServiceId }),
    });
  } catch {
    throw new ScannerServiceError("No fue posible conectar con el servicio de validación.");
  }

  let payload: AccessApiResponse;
  try {
    payload = (await response.json()) as AccessApiResponse;
  } catch {
    throw new ScannerServiceError("El servicio de validación devolvió una respuesta ilegible.");
  }

  if (!response.ok || !payload.success || !payload.data) {
    throw new ScannerServiceError(
      payload.error?.message ?? "No fue posible validar este ticket.",
    );
  }

  const { data } = payload;
  const common = {
    ticketId,
    reservationId: data.ticket.reservaId,
    userName: data.ticket.titularNombre,
    targetCourtName: data.ticket.servicioNombre,
  };

  if (data.code === "WINDOW_EXPIRED") {
    if (data.ticket.estado !== "EMITIDO") {
      throw new ScannerServiceError(
        "La respuesta de franja vencida debe conservar el boleto en estado EMITIDO.",
      );
    }
    const timestamp = payload.timestamp;
    const scannedDate = timestamp ? new Date(timestamp) : new Date();
    const slotStart = toBogotaDate(data.ticket.fecha, data.ticket.horaInicio);
    const slotEnd = toBogotaDate(data.ticket.fecha, data.ticket.horaFin);
    const windowPosition = scannedDate.getTime() < slotStart.getTime() ? "BEFORE" : "AFTER";
    const boundary = windowPosition === "BEFORE" ? slotStart : slotEnd;

    return {
      ...common,
      isValid: false,
      status: "EXPIRED",
      message: data.message ?? ACCESS_WINDOW_EXPIRED_MESSAGE,
      expiredDetails: {
        slotStart: hhmm(data.ticket.horaInicio),
        slotEnd: hhmm(data.ticket.horaFin),
        scannedAt: scannedDate.toISOString(),
        windowPosition,
        ticketStatus: data.ticket.estado,
        minutesFromBoundary: Math.max(
          1,
          Math.ceil(Math.abs(boundary.getTime() - scannedDate.getTime()) / 60_000),
        ),
      },
    };
  }

  if (data.code === "SERVICE_MISMATCH") {
    return {
      ...common,
      isValid: false,
      status: "WRONG_COURT",
      message: `Acceso denegado: el ticket pertenece a ${data.ticket.servicioNombre} y no al puesto seleccionado.`,
    };
  }

  if (data.code === "ALREADY_USED") {
    return {
      ...common,
      isValid: false,
      status: "ALREADY_USED",
      message: "Acceso denegado: este ticket ya fue utilizado.",
    };
  }

  if (data.code === "INVALID_STATE") {
    return {
      ...common,
      isValid: false,
      status: "INVALID",
      message: "Acceso denegado: el estado del ticket no permite el ingreso.",
    };
  }

  return {
    ...common,
    isValid: data.access === "GRANTED",
    status: data.access === "GRANTED" ? "VALID" : "INVALID",
    message:
      data.access === "GRANTED"
        ? data.resultado === "CONSULTA"
          ? "Ticket válido. Modo consulta: el boleto no fue consumido."
          : "Acceso concedido."
        : "Acceso denegado: no fue posible validar este ticket.",
  };
}
