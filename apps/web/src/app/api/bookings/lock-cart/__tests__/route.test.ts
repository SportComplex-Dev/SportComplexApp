/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../packages/db/test/mock-prisma";

const mock = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;

const { handleLockCart } = await import("../route");

function tomorrowBogota(): string {
  const now = new Date();
  const bogotaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const tomorrow = new Date(
    Date.UTC(bogotaNow.getUTCFullYear(), bogotaNow.getUTCMonth(), bogotaNow.getUTCDate() + 1),
  );
  return tomorrow.toISOString().slice(0, 10);
}

function seedSlots() {
  for (const key of ["usuarios", "servicios", "franjas", "disponibilidades", "reservas", "pagos"] as const) {
    mock._state[key].length = 0;
  }
  const dateStr = tomorrowBogota();
  const startsAt = new Date(`${dateStr}T10:00:00-05:00`);
  const diaSemana = startsAt.getUTCDay() === 0 ? 7 : startsAt.getUTCDay();

  mock._state.servicios.push(
    {
      id: 1,
      categoriaId: 1,
      nombre: "Cancha de Tenis",
      capacidadMaxima: 10,
      tarifa: 30000,
      modalidad: "AFORO",
      tipoPiscina: null,
      estado: "ACTIVO",
    },
    {
      id: 2,
      categoriaId: 1,
      nombre: "Piscina Libre",
      capacidadMaxima: 15,
      tarifa: 20000,
      modalidad: "AFORO",
      tipoPiscina: "PUBLICA",
      estado: "ACTIVO",
    },
  );
  mock._state.franjas.push(
    {
      id: 1,
      servicioId: 1,
      diaSemana,
      horaInicio: new Date(Date.UTC(1970, 0, 1, 10)),
      horaFin: new Date(Date.UTC(1970, 0, 1, 11)),
    },
    {
      id: 2,
      servicioId: 2,
      diaSemana,
      horaInicio: new Date(Date.UTC(1970, 0, 1, 10)),
      horaFin: new Date(Date.UTC(1970, 0, 1, 11)),
    },
  );
  mock._state.disponibilidades.push(
    {
      id: 1n,
      servicioId: 1,
      franjaId: 1,
      fecha: new Date(`${dateStr}T00:00:00.000Z`),
      cuposTotales: 10,
      cuposOcupados: 0,
      bloqueadaMantenimiento: false,
    },
    {
      id: 2n,
      servicioId: 2,
      franjaId: 2,
      fecha: new Date(`${dateStr}T00:00:00.000Z`),
      cuposTotales: 15,
      cuposOcupados: 0,
      bloqueadaMantenimiento: false,
    },
  );
}

const authenticatedAsClient = async () => ({
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    role: "CLIENTE",
    estado: "ACTIVO",
  },
});

const fakeStripeCheckout = async () => ({
  sessionId: "cs_test_cart_123",
  url: "https://checkout.stripe.com/pay/cs_test_cart_123",
  paymentIntentId: null,
  expiresAt: new Date(Date.now() + 30 * 60_000),
});

function validCartBody() {
  const dateStr = tomorrowBogota();
  const startsAt = new Date(`${dateStr}T10:00:00-05:00`);
  const endsAt = new Date(`${dateStr}T11:00:00-05:00`);
  return JSON.stringify({
    items: [
      {
        serviceId: 1,
        startTime: startsAt.toISOString(),
        endTime: endsAt.toISOString(),
        cantidadCupos: 1,
      },
      {
        serviceId: 2,
        startTime: startsAt.toISOString(),
        endTime: endsAt.toISOString(),
        cantidadCupos: 2,
      },
    ],
  });
}

test("POST /api/bookings/lock-cart: 401 si no hay sesión autenticada", async () => {
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: validCartBody(),
  });
  const res = await handleLockCart(req, async () => null);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.equal(json.error.code, "UNAUTHORIZED");
});

test("POST /api/bookings/lock-cart: 403 si el rol no es CLIENTE ACTIVO", async () => {
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: validCartBody(),
  });
  const res = await handleLockCart(req, async () => ({
    user: { id: "admin-1", role: "ADMINISTRADOR", estado: "ACTIVO" },
  }));
  assert.equal(res.status, 403);
  const json = await res.json();
  assert.equal(json.error.code, "FORBIDDEN");
});

test("POST /api/bookings/lock-cart: 400 si el carrito tiene menos de 2 ítems", async () => {
  const date = tomorrowBogota();
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          serviceId: 1,
          date,
          startTime: `${date}T10:00:00.000Z`,
          endTime: `${date}T11:00:00.000Z`,
          cantidadCupos: 1,
        },
      ],
    }),
  });
  const res = await handleLockCart(req, authenticatedAsClient);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, "VALIDATION_ERROR");
});

test("POST /api/bookings/lock-cart: éxito 201 crea holds y devuelve URL de Stripe Checkout", async () => {
  seedSlots();
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: validCartBody(),
  });
  const res = await handleLockCart(req, authenticatedAsClient, fakeStripeCheckout);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.reservas.length, 2);
  assert.equal(json.data.checkout.sessionId, "cs_test_cart_123");
  assert.equal(json.data.checkout.url, "https://checkout.stripe.com/pay/cs_test_cart_123");
  assert.ok(json.data.checkout.expiresAt);

  // Holds creados en estado PENDIENTE_PAGO
  assert.equal(mock._state.reservas.length, 2);
  assert.equal(mock._state.reservas[0].estado, "PENDIENTE_PAGO");
  assert.equal(mock._state.reservas[1].estado, "PENDIENTE_PAGO");
});

test("POST /api/bookings/lock-cart: error definitivo de Stripe ejecuta compensación de todas las reservas", async () => {
  seedSlots();
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: validCartBody(),
  });
  const failingStripe = async () => {
    throw new Error("card_declined");
  };
  const res = await handleLockCart(req, authenticatedAsClient, failingStripe);
  assert.equal(res.status, 502);
  const json = await res.json();
  assert.equal(json.error.code, "CHECKOUT_STRIPE_FAILED");

  // Todas las reservas fueron compensadas a EXPIRADA y cupos liberados
  assert.equal(mock._state.reservas.length, 2);
  assert.equal(mock._state.reservas[0].estado, "EXPIRADA");
  assert.equal(mock._state.reservas[1].estado, "EXPIRADA");
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, 0);
  assert.equal(mock._state.disponibilidades[1].cuposOcupados, 0);
});

test("POST /api/bookings/lock-cart: timeout simulado de Stripe NO compensa (mantiene holds para TTL)", async () => {
  seedSlots();
  const req = new Request("http://localhost:3000/api/bookings/lock-cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: validCartBody(),
  });
  const timeoutStripe = async () => {
    const err = new Error("Connection timed out");
    (err as any).code = "ETIMEDOUT";
    throw err;
  };
  const res = await handleLockCart(req, authenticatedAsClient, timeoutStripe);
  assert.equal(res.status, 504);
  const json = await res.json();
  assert.equal(json.error.code, "CHECKOUT_STRIPE_TIMEOUT");

  // Las reservas quedan PENDIENTE_PAGO delegando la expiración al TTL (CA-4)
  assert.equal(mock._state.reservas.length, 2);
  assert.equal(mock._state.reservas[0].estado, "PENDIENTE_PAGO");
  assert.equal(mock._state.reservas[1].estado, "PENDIENTE_PAGO");
  assert.equal(mock._state.disponibilidades[0].cuposOcupados, 1);
  assert.equal(mock._state.disponibilidades[1].cuposOcupados, 2);
});
