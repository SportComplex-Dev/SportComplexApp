import type { Prisma } from "@prisma/client";

export type BookingHistoryState =
  | "CONFIRMADA"
  | "EXPIRADA"
  | "CANCELADA_ADMINISTRATIVA";

export interface BookingHistoryCursor {
  createdAt: Date;
  id: string;
}

export type BookingTransaction = Prisma.TransactionClient;

export interface CartItemInput {
  serviceId: number;
  startTime: string;
  endTime: string;
  cantidadCupos: number;
}

export interface CartBookingResult {
  bookings: Array<{
    id: string;
    disponibilidadId: bigint;
    titularId: string;
    cantidadCupos: number;
    canal: string;
    estado: string;
    subtotal: Prisma.Decimal;
    descuentoPct: Prisma.Decimal;
    total: Prisma.Decimal;
    expiraEn: Date | null;
    creadoEn: Date;
    disponibilidad: {
      id: bigint;
      servicioId: number;
      fecha: Date;
      franja: {
        id: number;
        horaInicio: Date;
        horaFin: Date;
      };
      servicio: {
        id: number;
        nombre: string;
        tarifa: Prisma.Decimal;
        modalidad: string;
      };
    };
  }>;
  total: number;
  expiresAt: Date;
}
