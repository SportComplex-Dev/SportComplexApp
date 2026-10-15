export interface TicketInfo {
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
}

export interface VerifyResponseData {
  access: "GRANTED" | "DENIED";
  modo: "CONSULTA" | "TURNO";
  resultado: string;
  canjeado: boolean;
  isCached?: boolean;
  lecturaId?: string;
  ticket: TicketInfo;
}

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
  resultado?: "CONCEDIDO" | "DENEGADO_USADO" | "DENEGADO_SERVICIO" | "DENEGADO_HORARIO";
  code?: "ALREADY_USED" | "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "INVALID_STATE";
  message?: string;
  timestamp?: string;
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

export interface ZoneMismatch {
  /** Servicio al que pertenece el tiquete: zona a la que se debe dirigir al usuario. */
  ticketService: string;
  /** Servicio del puesto actual donde se realizó la lectura. */
  postService: string;
}
