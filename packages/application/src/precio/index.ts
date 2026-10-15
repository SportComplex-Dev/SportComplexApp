import { MEMBERSHIP_DISCOUNT_RATE, tasaDescuentoMembresia } from "@sportcomplex/domain/constantes";
import type { ResultadoDescuentoPrecio } from "@sportcomplex/domain/precio";

export type PricingDiscountResult = ResultadoDescuentoPrecio;

/**
 * RN-08: 30% descuento automático con membresía VIGENTE (online + taquilla).
 * Criterio: el descuento nunca supera el monto de la reserva.
 */
export function aplicarDescuentoMembresia(amountCents: number, hasActiveMembership: boolean): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("INVALID_AMOUNT");
  if (!hasActiveMembership) return amountCents;
  const rate = tasaDescuentoMembresia ?? MEMBERSHIP_DISCOUNT_RATE ?? 0.3;
  const discount = Math.min(Math.round(amountCents * rate), amountCents);
  return Math.max(0, amountCents - discount);
}

// Alias legado en inglés
export const applyMembershipDiscount = aplicarDescuentoMembresia;

/**
 * Aplica el descuento del 30% antes de generar el cobro si la membresía está VIGENTE.
 * Válido tanto para portal online como taquilla física (RF-16 / RN-08).
 * Garantía: el descuento nunca supera el monto de la reserva.
 */
export function calcularPrecioConDescuento(
  subtotal: number,
  hasActiveMembership: boolean,
): ResultadoDescuentoPrecio {
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
  const rate = tasaDescuentoMembresia ?? MEMBERSHIP_DISCOUNT_RATE ?? 0.3;
  const rawDiscount = Number((cleanSubtotal * rate).toFixed(2));
  const discountAmount = Math.min(rawDiscount, cleanSubtotal);
  const total = Number(Math.max(0, cleanSubtotal - discountAmount).toFixed(2));
  return {
    subtotal: cleanSubtotal,
    discountPct: rate * 100,
    discountAmount,
    total,
  };
}

// Alias legado en inglés
export const calculatePricingWithDiscount = calcularPrecioConDescuento;

/**
 * Calcula el valor total de una reserva.
 * Si el servicio es una cancha, el cobro es fijo por el espacio completo.
 * Para los demás servicios, se multiplica por la cantidad de asistentes.
 */
export function calcularPrecioReserva(item: { category: string; price: number }, attendees: number): number {
  if (item.category === "canchas") {
    return item.price;
  }
  return item.price * Math.max(1, attendees);
}

// Alias legado en inglés
export const calculateBookingPrice = calcularPrecioReserva;

export function formatearDinero(amount: number): string {
  return `$${amount.toLocaleString("es-CO")}`;
}

// Alias legado en inglés
export const formatMoney = formatearDinero;

export function iniciales(name: string): string {
  return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

// Alias legado en inglés
export const initials = iniciales;

export function formatearFecha(
  isoOrDate: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  if (!isoOrDate) return "";
  const date = typeof isoOrDate === "string"
    ? isoOrDate.includes("-") && isoOrDate.length === 10
      ? new Date(`${isoOrDate}T12:00:00`)
      : new Date(isoOrDate)
    : isoOrDate;
  const text = date.toLocaleDateString("es-CO", options);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Alias legado en inglés
export const formatDate = formatearFecha;

export type MetodoPago = "card" | "pse" | "wompi" | "on_site";
export type PaymentMethod = MetodoPago;
