import type { CategoriaSlug } from "../catalogo/tipos.js";

export type EstadoReserva =
  | 'PENDIENTE_PAGO'
  | 'CONFIRMADA'
  | 'EXPIRADA'
  | 'CANCELADA_ADMINISTRATIVA'
  | 'CANCELADA_PAGO'
  | 'BLOQUEADA_TTL'
  | 'Pendiente'
  | 'Confirmada'
  | 'Cancelada'
  | 'Usada';

export type BookingStatus = EstadoReserva;

export type EstadoTicket = 'EMITIDO' | 'USADO';
export type TicketStatus = EstadoTicket;

export type CanalReserva = 'ONLINE' | 'TAQUILLA';
export type BookingChannel = CanalReserva;

export interface Reserva {
  id: string;
  code: string;
  client: string;
  category: CategoriaSlug | string;
  service: string;
  sede: string;
  date: string;
  time: string;
  attendees: number;
  amount: number;
  status: EstadoReserva;
  paymentMethod?: string;
  paymentStatus?: 'Aprobada' | 'Pendiente' | 'Rechazada';
  transactionRef?: string;
  qrPayload?: string;
  qrDataUrl?: string;
}
export type Booking = Reserva;

export interface TicketQr {
  id: string;
  reservaId: string;
  codigo: string;
  estado: EstadoTicket;
  emitidoEn: Date;
  usadoEn?: Date | null;
  firma: string;
}
