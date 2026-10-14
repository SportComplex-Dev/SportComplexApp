export const BOOKING_WINDOW_DAYS = 15;
export const HOLD_TTL_MINUTES = 30;
export const BOGOTA_TIME_ZONE = "America/Bogota";
// TSK-BE-06 — mensaje contractual RN-01 (duplicado de @sportcomplex/core: db no puede importar core).
export const BOOKING_WINDOW_EXCEEDED_MESSAGE = "La reserva excede la ventana máxima permitida de 15 días";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BookingError";
  }
}
