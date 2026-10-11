/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

Reflect.set(process.env, "NODE_ENV", "test");

const { createMockPrisma } = await import(
  "../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const membershipsRoute = await import("../route");
const subscribeRoute = await import("../subscribe/route");

test("GET /api/memberships retorna lista de planes activos", async () => {
  const res = await membershipsRoute.GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.planes));
  assert.equal(body.data.planes.length, 3);
  assert.equal(body.data.planes[0].descuentoPct, 30.0);
});

test("POST /api/memberships/subscribe rechaza si no hay sesión autenticada (401)", async () => {
  (globalThis as any).__scAuthSession = null;

  const res = await subscribeRoute.POST(
    new Request("http://localhost:3000/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: 1 }),
    }),
  );

  assert.equal(res.status, 401);
});

test("POST /api/memberships/subscribe rechaza si el usuario ya tiene membresía VIGENTE (409)", async () => {
  const userId = "00000000-0000-4000-8000-0000000000sub1";
  (globalThis as any).__scAuthSession = {
    user: { id: userId, email: "sub1@test.com" },
  };

  mock._state.usuarios.push({
    id: userId,
    nombre: "Socio Existente",
    correo: "sub1@test.com",
    estado: "ACTIVO",
    rolId: 4,
    rolNombre: "Cliente",
  });

  mock._state.membresias.push({
    id: 99,
    usuarioId: userId,
    planId: 1,
    estado: "VIGENTE",
  });

  const res = await subscribeRoute.POST(
    new Request("http://localhost:3000/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: 2 }),
    }),
  );

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "DUPLICATE_ACTIVE_MEMBERSHIP");
});

test("POST /api/memberships/subscribe inicia sesión de checkout en Stripe", async () => {
  const userId = "00000000-0000-4000-8000-0000000000sub2";
  (globalThis as any).__scAuthSession = {
    user: { id: userId, email: "sub2@test.com" },
  };

  mock._state.usuarios.push({
    id: userId,
    nombre: "Nuevo Socio",
    correo: "sub2@test.com",
    estado: "ACTIVO",
    rolId: 4,
    rolNombre: "Cliente",
  });

  process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  (globalThis as any).__scStripeClient = {
    checkout: {
      sessions: {
        create: async () => ({
          id: "cs_test_sub_123",
          url: "https://checkout.stripe.com/pay/cs_test_sub_123",
        }),
      },
    },
  };

  const res = await subscribeRoute.POST(
    new Request("http://localhost:3000/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: 2 }),
    }),
  );

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.checkout.sessionId, "cs_test_sub_123");
  assert.ok(body.data.checkout.url);
});

test("POST /api/memberships/subscribe rechaza con 400 si el plan no tiene stripePriceId configurado", async () => {
  const userId = "00000000-0000-4000-8000-0000000000sub3";
  (globalThis as any).__scAuthSession = {
    user: { id: userId, email: "sub3@test.com" },
  };

  mock._state.usuarios.push({
    id: userId,
    nombre: "Usuario Sin Precio",
    correo: "sub3@test.com",
    estado: "ACTIVO",
    rolId: 4,
    rolNombre: "Cliente",
  });

  mock._state.planesMembresia.push({
    id: 999,
    nombre: "Plan Sin Stripe",
    periodicidad: "MENSUAL",
    precio: 99000,
    descuentoPct: 30.0,
    stripePriceId: null,
    activo: true,
  });

  const res = await subscribeRoute.POST(
    new Request("http://localhost:3000/api/memberships/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: 999 }),
    }),
  );

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "STRIPE_PRICE_NOT_CONFIGURED");
});

