export interface ExpiredSlotDetails {
  slotStart: string;
  slotEnd: string;
  scannedAt: string;
  minutesExceeded: number;
  courtToleranceMinutes: number;
}

export interface TicketValidationResponse {
  isValid: boolean;
  ticketId?: string;
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
      estado: "EMITIDO" | "USADO";
      servicioNombre: string;
      fecha: string;
      horaInicio: string;
      horaFin: string;
      titularNombre: string;
    };
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
  return new Date(`${fecha}T${hora}-05:00`);
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
    userName: data.ticket.titularNombre,
    targetCourtName: data.ticket.servicioNombre,
  };

  if (data.code === "WINDOW_EXPIRED") {
    const timestamp = payload.timestamp;
    const scannedDate = timestamp ? new Date(timestamp) : new Date();
    const slotEnd = toBogotaDate(data.ticket.fecha, data.ticket.horaFin);
    const minutesExceeded = Math.max(
      1,
      Math.ceil((scannedDate.getTime() - slotEnd.getTime()) / 60_000),
    );

    return {
      ...common,
      isValid: false,
      status: "EXPIRED",
      message: "Acceso denegado: la franja horaria de esta reserva ha vencido.",
      expiredDetails: {
        slotStart: hhmm(data.ticket.horaInicio),
        slotEnd: hhmm(data.ticket.horaFin),
        scannedAt: scannedDate.toISOString(),
        minutesExceeded,
        courtToleranceMinutes: 0,
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
