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

export type ShiftOption = {
  id: string;
  label: string;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  startTime: string;
  endTime: string;
  employeeId: string;
};

export type ResolvedTicket = {
  ticketId: string;
  code: string;
  holderName: string;
  venueId: string;
  venueName: string;
  courtId: string;
  courtName: string;
  startTime: string;
  endTime: string;
  attendees: number;
  status: "valid" | "used" | "expired" | "wrong-court" | "invalid";
  rawQr: string;
};

export type TicketValidationResult =
  | { ok: true; ticket: ResolvedTicket; message: string }
  | { ok: false; reason: "invalid" | "not-found" | "expired" | "used" | "wrong-court" | "error"; message: string };

export const scannerShiftOptions: ShiftOption[] = [
  {
    id: "shift-court-01",
    label: "Puesto 01",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-1",
    courtName: "Cancha 1 — Fútbol 5",
    startTime: "09:00",
    endTime: "12:00",
    employeeId: "emp-lector-01",
  },
  {
    id: "shift-court-02",
    label: "Puesto 02",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-2",
    courtName: "Cancha 2 — Fútbol 5",
    startTime: "12:00",
    endTime: "15:00",
    employeeId: "emp-lector-02",
  },
  {
    id: "shift-court-03",
    label: "Puesto 03",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-tennis-1",
    courtName: "Cancha 3 — Tenis",
    startTime: "15:00",
    endTime: "18:00",
    employeeId: "emp-lector-03",
  },
];

const mockTicketStore: Record<string, ResolvedTicket> = {
  "AKR-1001": {
    ticketId: "AKR-1001",
    code: "AKR-1001",
    holderName: "Mateo López",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-1",
    courtName: "Cancha 1 — Fútbol 5",
    startTime: "09:30",
    endTime: "10:30",
    attendees: 3,
    status: "valid",
    rawQr: "AKR-1001",
  },
  "AKR-1002": {
    ticketId: "AKR-1002",
    code: "AKR-1002",
    holderName: "Paula García",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-2",
    courtName: "Cancha 2 — Fútbol 5",
    startTime: "10:15",
    endTime: "11:15",
    attendees: 2,
    status: "valid",
    rawQr: "AKR-1002",
  },
  "AKR-1003": {
    ticketId: "AKR-1003",
    code: "AKR-1003",
    holderName: "Nicolás Rojas",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-sf-1",
    courtName: "Cancha 1 — Fútbol 5",
    startTime: "12:00",
    endTime: "13:00",
    attendees: 4,
    status: "expired",
    rawQr: "AKR-1003",
  },
  "AKR-1004": {
    ticketId: "AKR-1004",
    code: "AKR-1004",
    holderName: "Sofía Ortega",
    venueId: "venue-akros",
    venueName: "AKROS Club",
    courtId: "court-tennis-1",
    courtName: "Cancha 3 — Tenis",
    startTime: "16:00",
    endTime: "17:00",
    attendees: 1,
    status: "used",
    rawQr: "AKR-1004",
  },
};

export function extractTicketId(rawQr: string): string | null {
  const trimmed = rawQr.trim();

  if (!trimmed) {
    return null;
  }

  if (/^AKR-[A-Z0-9-]+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed.ticketId === "string") {
      return parsed.ticketId.toUpperCase();
    }
    if (typeof parsed.code === "string") {
      return parsed.code.toUpperCase();
    }
  } catch {
    // invalid JSON; fall through to URL parse below.
  }

  const urlMatch = trimmed.match(/(?:ticketId|code|ticket)=([A-Z0-9-]+)/i);
  if (urlMatch?.[1]) {
    return urlMatch[1].toUpperCase();
  }

  return null;
}

export async function validateTicketForShift(rawQr: string, activeShift: ShiftOption): Promise<TicketValidationResult> {
  await new Promise((resolve) => setTimeout(resolve, 650));

  const ticketId = extractTicketId(rawQr);
  if (!ticketId) {
    return {
      ok: false,
      reason: "invalid",
      message: "El QR no contiene un código de reserva o ticket válido.",
    };
  }

  const ticket = mockTicketStore[ticketId];
  if (!ticket) {
    return {
      ok: false,
      reason: "not-found",
      message: `No existe un ticket activo asociado al código ${ticketId}.`,
    };
  }

  if (ticket.status === "expired") {
    return {
      ok: false,
      reason: "expired",
      message: `El ticket ${ticket.ticketId} ya expiró y no puede usarse en este turno.`,
    };
  }

  if (ticket.status === "used") {
    return {
      ok: false,
      reason: "used",
      message: `El ticket ${ticket.ticketId} ya fue consumido anteriormente.`,
    };
  }

  if (ticket.courtId !== activeShift.courtId) {
    return {
      ok: false,
      reason: "wrong-court",
      message: `El ticket pertenece a ${ticket.courtName}, pero el turno activo es ${activeShift.courtName}.`,
    };
  }

  return {
    ok: true,
    ticket,
    message: `Ticket ${ticket.ticketId} validado correctamente para ${activeShift.courtName}.`,
  };
}

export async function redeemTicketAccess(ticket: ResolvedTicket, activeShift: ShiftOption): Promise<{ ok: boolean; payload: Record<string, string> }> {
  await new Promise((resolve) => setTimeout(resolve, 700));

  const payload = {
    ticketId: ticket.ticketId,
    empleadoId: activeShift.employeeId,
    venueId: activeShift.venueId,
    courtId: activeShift.courtId,
    scannedAt: new Date().toISOString(),
  };

  return { ok: true, payload };
}
