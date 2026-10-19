export type ModoLectura = 'TURNO' | 'CONSULTA';
export type ReadingMode = ModoLectura;

export type ResultadoLectura =
  | 'CONCEDIDO'
  | 'DENEGADO_SERVICIO'
  | 'DENEGADO_HORARIO'
  | 'DENEGADO_USADO'
  | 'CONSULTA';
export type ReadingResult = ResultadoLectura;

export interface VentanaAcceso {
  start: Date;
  end: Date;
}
export type AccessWindow = VentanaAcceso;

export type DecisionAcceso =
  | { allowed: true; consume: boolean }
  | {
      allowed: false;
      code: "SERVICE_MISMATCH" | "WINDOW_EXPIRED" | "ALREADY_USED" | "INVALID_STATE";
      message?: string;
    };
export type AccessDecision = DecisionAcceso;

export type RazonValidacionTicketBot =
  | "RESERVATION_CANCELLED"
  | "RESERVATION_NOT_CONFIRMED"
  | "SERVICE_INACTIVE"
  | "ALREADY_USED"
  | "WINDOW_EXPIRED";
export type BotTicketValidationReason = RazonValidacionTicketBot;

export const ACCESS_WINDOW_EXPIRED_MESSAGE =
  "Acceso denegado: Franja horaria vencida" as const;

export const ACCESS_SERVICE_MISMATCH_MESSAGE =
  "Acceso denegado: El tiquete no corresponde al puesto actual" as const;

export const ACCESS_ALREADY_USED_MESSAGE =
  "Acceso denegado: Tiquete ya utilizado" as const;
