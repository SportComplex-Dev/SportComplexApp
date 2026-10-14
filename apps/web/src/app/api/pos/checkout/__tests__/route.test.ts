/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "@db-test/mock-prisma";
import { createPosCheckoutPostHandler } from "@/app/api/pos/checkout/route";

Reflect.set(process.env, "NODE_ENV", "test");

const mock: any = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;

// Sin roles en BD: el checkout debe fallar cerrado en lugar de asumir rolId 1.
const POST = createPosCheckoutPostHandler({
  authorize: (async () => ({
    authorized: true,
    actor: { id: "vendedor-1" },
    response: null,
  })) as any,
});

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/pos/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const ventaValida = {
  serviceId: 1,
  date: "2026-11-20",
  slotTime: "10:00",
  cantidadCupos: 1,
  clienteNombre: "Cliente Mostrador",
  clienteDocumento: "12345678",
  clienteEmail: "nuevo@mostrador.com",
  paymentMode: "stripe_card",
};

test("POS checkout: sin rol CLIENTE en BD responde 500 ROLE_NOT_CONFIGURED (fail-closed)", async () => {
  mock._state.roles.length = 0;
  const res = await post(ventaValida);
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "ROLE_NOT_CONFIGURED");
});
