import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDesglosePlan,
  BENEFICIOS_POR_PERIODICIDAD,
  type PlanMembresiaDTO,
} from "../membership-utils";

// TSK-FE-20 (HU-20 / RF-16): Pruebas unitarias de la lógica de vista del portal de membresías

test("TSK-FE-20: calcularDesglosePlan calcula el 30% de descuento antes de confirmar cobro", () => {
  const mockPlan: PlanMembresiaDTO = {
    id: 1,
    nombre: "Plan Mensual Estándar",
    periodicidad: "MENSUAL",
    precio: 180000,
    descuentoPct: 30.0,
    stripePriceId: "price_mensual_123",
    activo: true,
  };

  const breakdown = calcularDesglosePlan(mockPlan);

  assert.equal(breakdown.id, 1);
  assert.equal(breakdown.nombre, "Plan Mensual Estándar");
  assert.equal(breakdown.periodicidad, "MENSUAL");
  assert.equal(breakdown.periodicidadLabel, "Mes");
  assert.equal(breakdown.precioOriginal, 180000);
  assert.equal(breakdown.porcentajeDescuento, 30.0);

  // 180.000 * 0.30 = 54.000
  assert.equal(breakdown.montoDescuento, 54000);

  // 180.000 - 54.000 = 126.000
  assert.equal(breakdown.precioConDescuento, 126000);
  assert.equal(breakdown.popular, true, "El plan mensual se destaca como el más popular");
  assert.ok(breakdown.beneficios.length >= 4, "Debe contener los beneficios detallados del plan");
});

test("TSK-FE-20: calcularDesglosePlan para plan SEMANAL y ANUAL", () => {
  const planSemanal: PlanMembresiaDTO = {
    id: 2,
    nombre: "Plan Semanal Básico",
    periodicidad: "SEMANAL",
    precio: 50000,
    descuentoPct: 30.0,
    stripePriceId: "price_semanal_123",
    activo: true,
  };

  const bdSemanal = calcularDesglosePlan(planSemanal);
  assert.equal(bdSemanal.precioOriginal, 50000);
  assert.equal(bdSemanal.montoDescuento, 15000);
  assert.equal(bdSemanal.precioConDescuento, 35000);
  assert.equal(bdSemanal.periodicidadLabel, "Semana");

  const planAnual: PlanMembresiaDTO = {
    id: 3,
    nombre: "Plan Anual Premium",
    periodicidad: "ANUAL",
    precio: 1800000,
    descuentoPct: 30.0,
    stripePriceId: "price_anual_123",
    activo: true,
  };

  const bdAnual = calcularDesglosePlan(planAnual);
  assert.equal(bdAnual.precioOriginal, 1800000);
  assert.equal(bdAnual.montoDescuento, 540000);
  assert.equal(bdAnual.precioConDescuento, 1260000);
  assert.equal(bdAnual.periodicidadLabel, "Año");
  assert.ok(bdAnual.ahorroAnualLabel, "El plan anual debe resaltar el ahorro de meses");
});

test("TSK-FE-20: Criterio Clave - El usuario ve el precio con y sin descuento antes de pagar", () => {
  const plan: PlanMembresiaDTO = {
    id: 10,
    nombre: "Plan Prueba",
    periodicidad: "MENSUAL",
    precio: 100000,
    descuentoPct: 30.0,
    stripePriceId: "price_test",
    activo: true,
  };

  const breakdown = calcularDesglosePlan(plan);

  // Verificamos que ambos precios existen explícitamente y están formateados
  assert.ok(breakdown.precioOriginalFormateado.length > 0);
  assert.ok(breakdown.montoDescuentoFormateado.length > 0);
  assert.ok(breakdown.precioConDescuentoFormateado.length > 0);
  assert.notEqual(breakdown.precioOriginalFormateado, breakdown.precioConDescuentoFormateado);

  // Garantía matemática
  assert.equal(breakdown.precioOriginal - breakdown.montoDescuento, breakdown.precioConDescuento);
});

test("TSK-FE-20: Beneficios por periodicidad definidos para SEMANAL, MENSUAL y ANUAL", () => {
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.SEMANAL.length > 0);
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.MENSUAL.length > 0);
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.ANUAL.length > 0);
});
