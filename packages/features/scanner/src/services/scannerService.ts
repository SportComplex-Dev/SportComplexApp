import {
  ACCESS_WINDOW_EXPIRED_MESSAGE,
  parseTicketQrPayload,
  TIMEZONE,
} from "@sportcomplex/core";
import type {
  ExpiredSlotDetails,
  RedeemTicketResponse,
  ScannedTicket,
  ShiftOption,
  TicketValidationResponse,
  ZoneMismatch,
} from "../types";

export type * from "../types";

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
  const parsedPayload = parseTicketQrPayload(value);
  if (parsedPayload) {
    return parsedPayload;
  }

  const separator = value.lastIndexOf(".");
  if (separator < 1 || separator === value.length - 1) {
    throw new ScannerServiceError("El código QR no contiene un ticket y una firma válidos.");
  }

  return {
    ticketId: value.slice(0, separator),
    signature: value.slice(separator + 1),
  };
}

export function toBogotaDate(fecha: string, hora: string): Date {
  const [year = 0, month = 1, day = 1] = fecha.slice(0, 10).split("-").map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = hora.split(":").map(Number);
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

export function hhmm(value: string): string {
  return value.slice(0, 5);
}

const ZONE_MISMATCH_PATTERN = /pertenece a (.+?) y se encuentra en (.+?)\s*$/i;

/**
 * TSK-FE-16 (HU-16 / RF-14): extrae ambos servicios del mensaje literal del
 * 403 de discrepancia de zona (TSK-BE-16):
 * "Acceso denegado: El tiquete pertenece a {X} y se encuentra en {Y}".
 * Devuelve `null` si el mensaje no sigue ese formato.
 */
export function parseZoneMismatch(message: string): ZoneMismatch | null {
  const match = ZONE_MISMATCH_PATTERN.exec(message.trim());
  if (!match) return null;
  const ticketService = match[1]?.trim() ?? "";
  const postService = match[2]?.trim() ?? "";
  if (ticketService.length === 0 || postService.length === 0) return null;
  return { ticketService, postService };
}

export function buildExpiredSlotDetails(
  ticket: {
    fecha: string;
    horaInicio: string;
    horaFin: string;
    estado?: "EMITIDO" | "USADO";
  },
  timestamp?: string,
): ExpiredSlotDetails {
  const scannedDate = timestamp ? new Date(timestamp) : new Date();
  const slotStart = toBogotaDate(ticket.fecha, ticket.horaInicio);
  const slotEnd = toBogotaDate(ticket.fecha, ticket.horaFin);
  const windowPosition = scannedDate.getTime() < slotStart.getTime() ? "BEFORE" : "AFTER";
  const boundary = windowPosition === "BEFORE" ? slotStart : slotEnd;

  return {
    slotStart: hhmm(ticket.horaInicio),
    slotEnd: hhmm(ticket.horaFin),
    scannedAt: scannedDate.toISOString(),
    windowPosition,
    ticketStatus: "EMITIDO",
    minutesFromBoundary: Math.max(
      1,
      Math.ceil(Math.abs(boundary.getTime() - scannedDate.getTime()) / 60_000),
    ),
  };
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

    return {
      ...common,
      isValid: false,
      status: "EXPIRED",
      message: data.message ?? ACCESS_WINDOW_EXPIRED_MESSAGE,
      expiredDetails: buildExpiredSlotDetails(data.ticket, payload.timestamp),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRedeemCode(value: unknown): value is NonNullable<RedeemTicketResponse["code"]> {
  return (
    value === "ALREADY_USED" ||
    value === "SERVICE_MISMATCH" ||
    value === "WINDOW_EXPIRED" ||
    value === "INVALID_STATE"
  );
}

function isRedeemTicket(value: unknown): value is NonNullable<RedeemTicketResponse["ticket"]> {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.reservaId === "string" &&
    (value.estado === "EMITIDO" || value.estado === "USADO") &&
    typeof value.servicioId === "number" &&
    typeof value.servicioNombre === "string" &&
    typeof value.fecha === "string" &&
    typeof value.horaInicio === "string" &&
    typeof value.horaFin === "string" &&
    typeof value.titularId === "string" &&
    typeof value.titularNombre === "string"
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error("El servidor devolvió una respuesta inválida.");
  }
}

function getApiError(payload: unknown): { code: string; message: string } | null {
  if (
    isRecord(payload) &&
    payload.success === false &&
    isRecord(payload.error) &&
    typeof payload.error.code === "string" &&
    typeof payload.error.message === "string"
  ) {
    return { code: payload.error.code, message: payload.error.message };
  }
  return null;
}

export const scannerService = {
  parseTicket(qrCode: string) {
    return parseTicketQrPayload(qrCode);
  },

  async getShiftOptions(): Promise<ShiftOption[]> {
    const response = await fetch("/api/access/services", { cache: "no-store" });
    const payload = await readJson(response);
    if (!response.ok) {
      const error = getApiError(payload);
      throw new Error(error?.message ?? "No se pudieron cargar los servicios de acceso.");
    }
    if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) {
      throw new Error("La respuesta de servicios de acceso tiene un formato inválido.");
    }

    return payload.data.map((service: unknown) => {
      if (
        !isRecord(service) ||
        typeof service.id !== "number" ||
        !Number.isInteger(service.id) ||
        service.id <= 0 ||
        typeof service.nombre !== "string" ||
        service.nombre.trim().length === 0
      ) {
        throw new Error("El servidor devolvió un servicio de acceso inválido.");
      }
      return {
        id: String(service.id),
        postServiceId: service.id,
        label: `Puesto ${service.id}`,
        courtName: service.nombre,
      };
    });
  },

  async redeemTicket(
    ticket: Pick<ScannedTicket, "ticketId" | "signature">,
    postServiceId: number,
  ): Promise<RedeemTicketResponse> {
    if (!Number.isInteger(postServiceId) || postServiceId <= 0) {
      throw new Error("Selecciona un puesto/servicio válido antes de canjear el ticket.");
    }

    const response = await fetch("/api/access/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: ticket.ticketId,
        signature: ticket.signature,
        postServiceId,
      }),
    });
    const payload = await readJson(response);
    const apiError = getApiError(payload);

    if (apiError?.code === "SERVICE_MISMATCH") {
      return {
        access: "DENIED",
        resultado: "DENEGADO_SERVICIO",
        code: "SERVICE_MISMATCH",
        message: apiError.message,
      };
    }
    if (!response.ok) {
      throw new Error(apiError?.message ?? "No se pudo procesar el canje.");
    }
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      throw new Error("La respuesta de canje tiene un formato inválido.");
    }

    const data = payload.data;
    if (data.access !== "GRANTED" && data.access !== "DENIED") {
      throw new Error("La respuesta de canje no contiene un resultado de acceso válido.");
    }
    if (
      data.resultado !== undefined &&
      data.resultado !== "CONCEDIDO" &&
      data.resultado !== "DENEGADO_USADO" &&
      data.resultado !== "DENEGADO_SERVICIO" &&
      data.resultado !== "DENEGADO_HORARIO"
    ) {
      throw new Error("La respuesta de canje contiene un resultado desconocido.");
    }
    if (data.code !== undefined && !isRedeemCode(data.code)) {
      throw new Error("La respuesta de canje contiene un código de denegación desconocido.");
    }
    if (data.ticket !== undefined && !isRedeemTicket(data.ticket)) {
      throw new Error("La respuesta de canje contiene los datos de ticket en un formato inválido.");
    }

    return {
      access: data.access,
      ...(typeof (payload as { timestamp?: unknown }).timestamp === "string"
        ? { timestamp: (payload as { timestamp: string }).timestamp }
        : {}),
      ...(data.resultado === "CONCEDIDO" ||
      data.resultado === "DENEGADO_USADO" ||
      data.resultado === "DENEGADO_SERVICIO" ||
      data.resultado === "DENEGADO_HORARIO"
        ? { resultado: data.resultado }
        : {}),
      ...(isRedeemCode(data.code) ? { code: data.code } : {}),
      ...(typeof data.message === "string" ? { message: data.message } : {}),
      ...(isRedeemTicket(data.ticket) ? { ticket: data.ticket } : {}),
    };
  },
};
