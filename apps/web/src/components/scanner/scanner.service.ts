export type ScannerFlowState =
  | "idle"
  | "configuring-shift"
  | "starting-camera"
  | "scanning"
  | "ticket-detected"
  | "validating-ticket"
  | "ticket-valid"
  | "ticket-invalid"
  | "access-granted"
  | "access-denied"
  | "redeeming"
  | "redeem-error"
  | "camera-error";

export interface ShiftContext {
  empleadoId: string;
  venueId: string;
  courtId: string;
}

export interface TicketValidationPayload {
  qrCode: string;
  courtId: string;
}

export interface TicketValidationResponse {
  isValid: boolean;
  ticketId?: string;
  userName?: string;
  targetCourtName?: string;
  status: "VALID" | "WRONG_COURT" | "EXPIRED" | "ALREADY_USED" | "INVALID";
  message: string;
}

export interface RedeemTicketPayload {
  ticketId: string;
  empleadoId: string;
  courtId: string;
  venueId: string;
  scannedAt: string;
}

export interface RedeemTicketResponse {
  success: boolean;
  redeemedAt: string;
  message: string;
}

export interface ShiftOption extends ShiftContext {
  id: string;
  label: string;
  venueName: string;
  courtName: string;
  startTime: string;
  endTime: string;
}

export interface ScannerServiceAdapter {
  getShiftOptions(): Promise<ShiftOption[]>;
  validateTicket(payload: TicketValidationPayload): Promise<TicketValidationResponse>;
  redeemTicket(payload: RedeemTicketPayload): Promise<RedeemTicketResponse>;
}

const mockShiftOptions: ShiftOption[] = [
  {
    id: "shift-court-01",
    label: "Puesto 01",
    empleadoId: "emp-lector-01",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-1",
    courtName: "Cancha 1 — Fútbol 5",
    startTime: "09:00",
    endTime: "12:00",
  },
  {
    id: "shift-court-02",
    label: "Puesto 02",
    empleadoId: "emp-lector-02",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-2",
    courtName: "Cancha 2 — Fútbol 5",
    startTime: "12:00",
    endTime: "15:00",
  },
  {
    id: "shift-court-03",
    label: "Puesto 03",
    empleadoId: "emp-lector-03",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-tennis-1",
    courtName: "Cancha 3 — Tenis",
    startTime: "15:00",
    endTime: "18:00",
  },
];

interface MockTicket extends Pick<TicketValidationResponse, "ticketId" | "userName" | "targetCourtName" | "status"> {
  courtId: string;
}

const mockTickets: Record<string, MockTicket> = {
  "AKR-1001": {
    ticketId: "AKR-1001",
    userName: "Mateo López",
    targetCourtName: "Cancha 1 — Fútbol 5",
    courtId: "court-sf-1",
    status: "VALID",
  },
  "AKR-1002": {
    ticketId: "AKR-1002",
    userName: "Paula García",
    targetCourtName: "Cancha 2 — Fútbol 5",
    courtId: "court-sf-2",
    status: "VALID",
  },
  "AKR-1003": {
    ticketId: "AKR-1003",
    userName: "Nicolás Rojas",
    targetCourtName: "Cancha 1 — Fútbol 5",
    courtId: "court-sf-1",
    status: "EXPIRED",
  },
  "AKR-1004": {
    ticketId: "AKR-1004",
    userName: "Sofía Ortega",
    targetCourtName: "Cancha 3 — Tenis",
    courtId: "court-tennis-1",
    status: "ALREADY_USED",
  },
};

function extractTicketId(qrCode: string): string | null {
  const trimmed = qrCode.trim();
  if (!trimmed) return null;

  if (/^AKR-[A-Z0-9-]+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && "ticketId" in parsed && typeof parsed.ticketId === "string") {
      return parsed.ticketId.toUpperCase();
    }
    if (typeof parsed === "object" && parsed !== null && "code" in parsed && typeof parsed.code === "string") {
      return parsed.code.toUpperCase();
    }
  } catch {
    // A non-JSON QR value may still contain a ticket URL.
  }

  const urlMatch = trimmed.match(/(?:ticketId|code|ticket)=([A-Z0-9-]+)/i);
  return urlMatch?.[1]?.toUpperCase() ?? null;
}

const mockScannerAdapter: ScannerServiceAdapter = {
  async getShiftOptions() {
    return mockShiftOptions;
  },

  async validateTicket({ qrCode, courtId }) {
    const ticketId = extractTicketId(qrCode);
    if (!ticketId) {
      return {
        isValid: false,
        status: "INVALID",
        message: "El QR no contiene un código de reserva o ticket válido.",
      };
    }

    const ticket = mockTickets[ticketId];
    if (!ticket) {
      return {
        isValid: false,
        ticketId,
        status: "INVALID",
        message: `No existe un ticket activo asociado al código ${ticketId}.`,
      };
    }

    if (ticket.status === "EXPIRED") {
      return {
        ticketId: ticket.ticketId,
        userName: ticket.userName,
        targetCourtName: ticket.targetCourtName,
        isValid: false,
        status: "EXPIRED",
        message: `El ticket ${ticketId} ya expiró y no puede usarse en este turno.`,
      };
    }

    if (ticket.status === "ALREADY_USED") {
      return {
        ticketId: ticket.ticketId,
        userName: ticket.userName,
        targetCourtName: ticket.targetCourtName,
        isValid: false,
        status: "ALREADY_USED",
        message: `El ticket ${ticketId} ya fue consumido anteriormente.`,
      };
    }

    if (ticket.courtId !== courtId) {
      return {
        ticketId: ticket.ticketId,
        userName: ticket.userName,
        targetCourtName: ticket.targetCourtName,
        isValid: false,
        status: "WRONG_COURT",
        message: `El ticket pertenece a ${ticket.targetCourtName}; el puesto activo corresponde a otra cancha.`,
      };
    }

    return {
      ticketId: ticket.ticketId,
      userName: ticket.userName,
      targetCourtName: ticket.targetCourtName,
      isValid: true,
      status: "VALID",
      message: `Ticket ${ticketId} validado correctamente.`,
    };
  },

  async redeemTicket({ ticketId }) {
    return {
      success: true,
      redeemedAt: new Date().toISOString(),
      message: `Acceso concedido para el ticket ${ticketId}.`,
    };
  },
};

// Swap this adapter for the TSK-BE-14 HTTP adapter once its routes are available.
const scannerAdapter: ScannerServiceAdapter = mockScannerAdapter;

export const scannerService = {
  getShiftOptions: () => scannerAdapter.getShiftOptions(),
  validateTicket: (qrCode: string, shift: ShiftContext) =>
    scannerAdapter.validateTicket({ qrCode, courtId: shift.courtId }),
  redeemTicket: (ticketId: string, shift: ShiftContext) =>
    scannerAdapter.redeemTicket({
      ticketId,
      empleadoId: shift.empleadoId,
      courtId: shift.courtId,
      venueId: shift.venueId,
      scannedAt: new Date().toISOString(),
    }),
};
