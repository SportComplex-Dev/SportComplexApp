import { MEMBERSHIP_DISCOUNT_RATE } from "../domain/index";

// RN-08: 30% descuento automático con membresía VIGENTE (online + taquilla)
export function applyMembershipDiscount(amountCents: number, hasActiveMembership: boolean): number {
  if (!Number.isInteger(amountCents) || amountCents < 0) throw new Error("INVALID_AMOUNT");
  if (!hasActiveMembership) return amountCents;
  return Math.round(amountCents * (1 - MEMBERSHIP_DISCOUNT_RATE));
}
