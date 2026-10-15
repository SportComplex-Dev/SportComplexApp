import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularDesglosePlan,
  evaluateMembershipPurchaseAccess,
  iniciarSuscripcionStripe,
  BENEFICIOS_POR_PERIODICIDAD,
  type PlanMembresiaDTO,
} from "../utils/membership-utils";

// TSK-FE-20 (HU-20 / RF-16): Pruebas unitarias de la lógica de vista del portal de membresías

test("TSK-FE-20: calcularDesglosePlan respeta la tarifa autoritativa del plan e incluye 30% en reservas", () => {
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
  assert.equal(breakdown.precio, 180000);
  assert.equal(breakdown.precioFormateado, "$180.000");
  assert.equal(breakdown.porcentajeDescuento, 30.0);

  // La tarifa de suscripción no se reduce artificialmente; el 30% aplica sobre reservas
  assert.equal(breakdown.precioOriginal, 180000);
  assert.equal(breakdown.precioConDescuento, 180000);
  assert.equal(breakdown.popular, true, "El plan mensual se destaca como el más popular");
  assert.ok(breakdown.beneficios.length >= 4, "Debe contener los beneficios detallados del plan");
});

test("TSK-FE-20: calcularDesglosePlan para plan SEMANAL y ANUAL con ahorro anual", () => {
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
  assert.equal(bdSemanal.precio, 50000);
  assert.equal(bdSemanal.precioFormateado, "$50.000");
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
  assert.equal(bdAnual.precio, 1800000);
  assert.equal(bdAnual.precioFormateado, "$1.800.000");
  assert.equal(bdAnual.periodicidadLabel, "Año");
  assert.ok(bdAnual.ahorroAnualLabel, "El plan anual debe resaltar el ahorro de meses");
});

test("TSK-FE-20: calcularDesglosePlan no sobreescribe precios arbitrariamente (DAT-01)", () => {
  const planPromocional: PlanMembresiaDTO = {
    id: 99,
    nombre: "Plan Prueba Simbólico",
    periodicidad: "SEMANAL",
    precio: 2500, // Menor a 5000 COP
    descuentoPct: 30.0,
    stripePriceId: "price_simbolico",
    activo: true,
  };

  const breakdown = calcularDesglosePlan(planPromocional);
  // Debe mantenerse en 2500, jamás forzarse a 50000
  assert.equal(breakdown.precio, 2500);
  assert.equal(breakdown.precioFormateado, "$2.500");
});

test("TSK-FE-20: Beneficios por periodicidad definidos para SEMANAL, MENSUAL y ANUAL", () => {
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.SEMANAL.length > 0);
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.MENSUAL.length > 0);
  assert.ok(BENEFICIOS_POR_PERIODICIDAD.ANUAL.length > 0);
});

test("TSK-FE-20: iniciarSuscripcionStripe gestiona sesión exitosa", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          checkout: {
            url: "https://checkout.stripe.com/c/pay/cs_test_123",
            sessionId: "cs_test_123",
          },
        },
      }),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const res = await iniciarSuscripcionStripe(1);
    assert.equal(res.success, true);
    assert.equal(res.url, "https://checkout.stripe.com/c/pay/cs_test_123");
    assert.equal(res.sessionId, "cs_test_123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TSK-FE-20: iniciarSuscripcionStripe detecta 401 UNAUTHORIZED", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: "UNAUTHORIZED", message: "No autenticado" },
      }),
    } as unknown as Response;
  }) as typeof fetch;

  try {
    const res = await iniciarSuscripcionStripe(1);
    assert.equal(res.success, false);
    assert.equal(res.errorCode, "UNAUTHORIZED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TSK-FE-20: evaluateMembershipPurchaseAccess valida visitante no autenticado y preserva planId en redirectUrl", () => {
  const result = evaluateMembershipPurchaseAccess({
    session: null,
    planId: 2,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "UNAUTHENTICATED");
  assert.equal(result.redirectUrl, "/login?redirect=%2Fportal%2Fmembership%3FplanId%3D2");
  assert.ok(result.message);
});

test("TSK-FE-20: evaluateMembershipPurchaseAccess rechaza rol no cliente (ej. Empleado_Vendedor)", () => {
  const result = evaluateMembershipPurchaseAccess({
    session: { role: "Empleado_Vendedor" },
    planId: 2,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "FORBIDDEN_ROLE");
  assert.equal(result.redirectUrl, undefined);
  assert.ok(result.message);
});

test("TSK-FE-20: evaluateMembershipPurchaseAccess rechaza rol no cliente (ej. Administrador)", () => {
  const result = evaluateMembershipPurchaseAccess({
    session: { role: "Administrador" },
    planId: 1,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "FORBIDDEN_ROLE");
});

test("TSK-FE-20: evaluateMembershipPurchaseAccess rechaza compra si ya tiene membresía vigente", () => {
  const result = evaluateMembershipPurchaseAccess({
    session: { role: "Cliente" },
    planId: 3,
    hasVigenteMembership: true,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.status, "ACTIVE_MEMBERSHIP");
});

test("TSK-FE-20: evaluateMembershipPurchaseAccess permite compra a cliente autenticado", () => {
  const result = evaluateMembershipPurchaseAccess({
    session: { role: "Cliente" },
    planId: 2,
    hasVigenteMembership: false,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.status, "ALLOWED");

  // Soporte case-insensitive (CLIENTE o customer)
  const resultUpper = evaluateMembershipPurchaseAccess({
    session: { role: "CLIENTE" },
    planId: 2,
    hasVigenteMembership: false,
  });
  assert.equal(resultUpper.allowed, true);
  assert.equal(resultUpper.status, "ALLOWED");
});
