import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMembershipDiscount,
  calculatePricingWithDiscount,
  calculateBookingPrice,
} from "./pricing";

test("RN-08: applyMembershipDiscount aplica el 30% a un monto entero en centavos con membresía activa", () => {
  const result = applyMembershipDiscount(10000, true);
  // 10000 * 0.7 = 7000
  assert.equal(result, 7000);
});

test("RN-08: applyMembershipDiscount sin membresía no modifica el monto", () => {
  const result = applyMembershipDiscount(10000, false);
  assert.equal(result, 10000);
});

test("RN-08 / Criterio Clave: el descuento nunca supera el monto de la reserva", () => {
  // Cero centavos
  assert.equal(applyMembershipDiscount(0, true), 0);
  assert.equal(applyMembershipDiscount(0, false), 0);

  const pricingZero = calculatePricingWithDiscount(0, true);
  assert.equal(pricingZero.discountAmount, 0);
  assert.equal(pricingZero.total, 0);
  assert.ok(pricingZero.discountAmount <= pricingZero.subtotal);

  const pricingNormal = calculatePricingWithDiscount(50000, true);
  assert.equal(pricingNormal.subtotal, 50000);
  assert.equal(pricingNormal.discountPct, 30.0);
  assert.equal(pricingNormal.discountAmount, 15000);
  assert.equal(pricingNormal.total, 35000);
  assert.ok(pricingNormal.discountAmount <= pricingNormal.subtotal);
});

test("RN-08: applyMembershipDiscount rechaza valores negativos o no enteros", () => {
  assert.throws(() => applyMembershipDiscount(-100, true), /INVALID_AMOUNT/);
  assert.throws(() => applyMembershipDiscount(10.5, true), /INVALID_AMOUNT/);
});

test("RF-16: calculatePricingWithDiscount opera tanto para portal como taquilla", () => {
  // Simulación de reserva en portal o taquilla para cancha de $60.000
  const portalConMembresia = calculatePricingWithDiscount(60000, true);
  assert.deepEqual(portalConMembresia, {
    subtotal: 60000,
    discountPct: 30,
    discountAmount: 18000,
    total: 42000,
  });

  const taquillaSinMembresia = calculatePricingWithDiscount(60000, false);
  assert.deepEqual(taquillaSinMembresia, {
    subtotal: 60000,
    discountPct: 0,
    discountAmount: 0,
    total: 60000,
  });
});

test("calculateBookingPrice multiplica adecuadamente por asistentes según categoría", () => {
  assert.equal(calculateBookingPrice({ category: "canchas", price: 50000 }, 4), 50000);
  assert.equal(calculateBookingPrice({ category: "piscina", price: 15000 }, 3), 45000);
});
