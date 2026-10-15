export interface DineroCentavos {
  amountCents: number;
  currency: 'COP';
}
export type MoneyCents = DineroCentavos;

export type MetodoPago = 'card' | 'link' | 'wompi' | 'nequi' | 'daviplata' | 'transferencia' | 'efectivo';
export type PaymentMethod = MetodoPago;

export interface ResultadoDescuentoPrecio {
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
}
export type PricingDiscountResult = ResultadoDescuentoPrecio;

export type TipoPago = 'RESERVA' | 'MEMBRESIA' | 'TORNEO';
export type PaymentType = TipoPago;

export type EstadoPago = 'PENDIENTE' | 'APROBADO' | 'FALLIDO';
export type PaymentStatus = EstadoPago;
