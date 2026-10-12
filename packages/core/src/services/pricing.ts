import { MEMBERSHIP_DISCOUNT_RATE } from "../domain/index";

// RN-08: 30% descuento automático con membresía VIGENTE (online + taquilla)
export function applyMembershipDiscount(amountCents: number, hasActiveMembership: boolean): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("INVALID_AMOUNT");
  if (!hasActiveMembership) return amountCents;
  // Criterio: el descuento nunca supera el monto de la reserva
  const discount = Math.min(Math.round(amountCents * MEMBERSHIP_DISCOUNT_RATE), amountCents);
  return Math.max(0, amountCents - discount);
}

export interface PricingDiscountResult {
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
}

/**
 * Aplica el descuento del 30% antes de generar el cobro si la membresía está VIGENTE.
 * Válido tanto para portal online como taquilla física (RF-16 / RN-08).
 * Garantía: el descuento nunca supera el monto de la reserva.
 */
export function calculatePricingWithDiscount(
  subtotal: number,
  hasActiveMembership: boolean,
): PricingDiscountResult {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error("INVALID_AMOUNT");
  }
  const cleanSubtotal = Number(subtotal.toFixed(2));
  if (!hasActiveMembership) {
    return {
      subtotal: cleanSubtotal,
      discountPct: 0,
      discountAmount: 0,
      total: cleanSubtotal,
    };
  }
  // RN-08: 30% automático. El descuento nunca supera el monto de la reserva.
  const rawDiscount = Number((cleanSubtotal * MEMBERSHIP_DISCOUNT_RATE).toFixed(2));
  const discountAmount = Math.min(rawDiscount, cleanSubtotal);
  const total = Number(Math.max(0, cleanSubtotal - discountAmount).toFixed(2));
  return {
    subtotal: cleanSubtotal,
    discountPct: 30.0,
    discountAmount,
    total,
  };
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

export function initials(name: string): string {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export function formatDate(
  isoOrDate: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
): string {
  if (!isoOrDate) return '';
  const date = typeof isoOrDate === 'string'
    ? isoOrDate.includes('-') && isoOrDate.length === 10
      ? new Date(`${isoOrDate}T12:00:00`)
      : new Date(isoOrDate)
    : isoOrDate;
  const text = date.toLocaleDateString('es-CO', options);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type PaymentMethod = 'card' | 'pse' | 'wompi' | 'on_site';

/**
 * Calcula el valor total de una reserva.
 * Si el servicio es una cancha, el cobro es fijo por el espacio completo.
 * Para los demás servicios, se multiplica por la cantidad de asistentes.
 */
export function calculateBookingPrice(item: { category: string; price: number }, attendees: number): number {
  if (item.category === 'canchas') {
    return item.price;
  }
  return item.price * Math.max(1, attendees);
}
