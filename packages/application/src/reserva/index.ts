import type { EstadoReserva } from "@sportcomplex/domain/reserva";
import { validarVentanaReserva } from "../disponibilidad/index.js";

export class ReservaInvarianteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ReservaInvarianteError";
  }
}

export interface BloquearReservaInput {
  servicioId: string | number;
  fecha: Date | string;
  franjaHoraInicio: Date | string;
  cupos: number;
  capacidadMaxima: number;
  cuposOcupadosActuales: number;
  now?: Date;
}

export interface BloquearReservaResult {
  permitido: boolean;
  cuposRestantes: number;
  expiraEn: Date;
}

/**
 * RN-01, RN-11, RN-04:
 * Valida invariantes para bloquear una reserva provisionalmente en carrito:
 * 1. Ventana de reserva válida (no en el pasado, máx 15 días).
 * 2. Capacidad y cupos válidos (> 0 y cupos <= cupos disponibles).
 * 3. Asigna TTL de 30 minutos al bloqueo.
 */
export function bloquearReserva(input: BloquearReservaInput): BloquearReservaResult {
  const now = input.now ?? new Date();

  // Fecha/hora de inicio
  const start =
    input.franjaHoraInicio instanceof Date
      ? input.franjaHoraInicio
      : new Date(
          typeof input.fecha === "string" && input.fecha.includes("-")
            ? `${input.fecha.slice(0, 10)}T${String(input.franjaHoraInicio).trim().slice(0, 8)}-05:00`
            : String(input.franjaHoraInicio),
        );

  validarVentanaReserva(start, now);

  if (input.cupos <= 0) {
    throw new ReservaInvarianteError("La cantidad de cupos debe ser mayor a 0", "INVALID_ATTENDEES");
  }

  const cuposDisponibles = input.capacidadMaxima - input.cuposOcupadosActuales;
  if (input.cupos > cuposDisponibles) {
    throw new ReservaInvarianteError(
      `Capacidad insuficiente: solicitados ${input.cupos}, disponibles ${cuposDisponibles}`,
      "CAPACITY_EXCEEDED",
    );
  }

  const expiraEn = new Date(now.getTime() + 30 * 60 * 1000); // 30 min TTL

  return {
    permitido: true,
    cuposRestantes: cuposDisponibles - input.cupos,
    expiraEn,
  };
}

export interface ItemCarritoBloqueo {
  servicioId: string | number;
  fecha: Date | string;
  franjaHoraInicio: Date | string;
  cupos: number;
  capacidadMaxima: number;
  cuposOcupadosActuales: number;
}

/**
 * Valida un conjunto de reservas en un carrito antes de iniciar checkout.
 */
export function bloquearCarrito(items: ItemCarritoBloqueo[], now: Date = new Date()): BloquearReservaResult[] {
  if (!items || items.length === 0) {
    throw new ReservaInvarianteError("El carrito está vacío", "EMPTY_CART");
  }
  return items.map((item) => bloquearReserva({ ...item, now }));
}

/**
 * RN-04 / RF-12: Valida invariantes para la cancelación de una reserva.
 * No se pueden cancelar reservas ya EXPIRADA, CANCELADA_ADMINISTRATIVA o CANCELADA_PAGO.
 */
export function cancelarReserva(reserva: {
  id: string;
  estado: EstadoReserva | string;
  fecha?: Date | string;
  franjaInicio?: Date | string;
}): { cancelable: boolean; nuevoEstado: EstadoReserva } {
  const estado = reserva.estado;

  if (
    estado === "EXPIRADA" ||
    estado === "CANCELADA_ADMINISTRATIVA" ||
    estado === "CANCELADA_PAGO" ||
    estado === "Cancelada" ||
    estado === "Usada"
  ) {
    throw new ReservaInvarianteError(
      `No se puede cancelar una reserva con estado ${estado}`,
      "INVALID_RESERVATION_STATE",
    );
  }

  return {
    cancelable: true,
    nuevoEstado: "CANCELADA_ADMINISTRATIVA",
  };
}
