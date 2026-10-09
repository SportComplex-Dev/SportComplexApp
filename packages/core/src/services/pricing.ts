import { MEMBERSHIP_DISCOUNT_RATE } from "../domain/index";

// RN-08: 30% descuento automático con membresía VIGENTE (online + taquilla)
export function applyMembershipDiscount(amountCents: number, hasActiveMembership: boolean): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("INVALID_AMOUNT");
  if (!hasActiveMembership) return amountCents;
  return Math.round(amountCents * (1 - MEMBERSHIP_DISCOUNT_RATE));
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
