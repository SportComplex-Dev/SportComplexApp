import { parseTicketQrPayload } from "@sportcomplex/core";

export type ScannerFlowState =
  | "idle"
  | "configuring-shift"
  | "starting-camera"
  | "scanning"
  | "ticket-valid"
  | "ticket-invalid"
  | "access-granted"
  | "access-denied"
  | "redeeming"
  | "redeem-error"
  | "camera-error";

export interface ShiftOption {
  id: string;
  postServiceId: number;
  label: string;
  courtName: string;
}

export interface ScannedTicket {
  ticketId: string;
  signature: string;
  result?: RedeemTicketResponse;
}

export interface RedeemTicketResponse {
  access: "GRANTED" | "DENIED";
  code?: "ALREADY_USED" | "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "INVALID_STATE";
  message?: string;
  ticket?: {
    id: string;
    reservaId: string;
    estado: "EMITIDO" | "USADO";
    servicioId: number;
    servicioNombre: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    titularId: string;
    titularNombre: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRedeemCode(value: unknown): value is NonNullable<RedeemTicketResponse["code"]> {
  return value === "ALREADY_USED" ||
    value === "SERVICE_MISMATCH" ||
    value === "WINDOW_EXPIRED" ||
    value === "INVALID_STATE";
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
      return { access: "DENIED", code: "SERVICE_MISMATCH", message: apiError.message };
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
    if (data.code !== undefined && !isRedeemCode(data.code)) {
      throw new Error("La respuesta de canje contiene un código de denegación desconocido.");
    }
    if (data.ticket !== undefined && !isRedeemTicket(data.ticket)) {
      throw new Error("La respuesta de canje contiene los datos de ticket en un formato inválido.");
    }

    return {
      access: data.access,
      ...(isRedeemCode(data.code) ? { code: data.code } : {}),
      ...(typeof data.message === "string" ? { message: data.message } : {}),
      ...(isRedeemTicket(data.ticket) ? { ticket: data.ticket } : {}),
    };
  },
};
