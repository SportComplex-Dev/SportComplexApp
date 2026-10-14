/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "@db-test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");

const mock = createMockPrisma();
(globalThis as unknown as { __scPrisma: unknown }).__scPrisma = mock;

mock._state.categorias.push({
  id: 1,
  nombre: "Canchas",
  tipo: "CANCHA",
});

mock._state.servicios.push(
  {
    id: 1,
    categoriaId: 1,
    nombre: "Fútbol 5 · Cancha 1",
    capacidadMaxima: 10,
    tarifa: 80000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  },
  {
    id: 2,
    categoriaId: 1,
    nombre: "Fútbol 5 · Cancha 2",
    capacidadMaxima: 10,
    tarifa: 80000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "INACTIVO",
  },
);

const catalogoRoute = await import("@/app/api/public/catalogo/route");

test("API: GET /api/public/catalogo retorna solo servicios ACTIVO con categorias", async () => {
  const res = await catalogoRoute.GET();
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.servicios));
  assert.ok(Array.isArray(body.data.categorias));

  const ids = body.data.servicios.map((s: any) => s.id);
  assert.ok(ids.includes(1));
  assert.ok(!ids.includes(2));

  const categoria = body.data.categorias.find((c: any) => c.id === 1);
  assert.ok(categoria);
  assert.equal(categoria.nombre, "Canchas");
});

test("API: GET /api/public/catalogo responde 500 con error controlado si la BD falla", async () => {
  const original = mock.categoriaServicio.findMany;
  mock.categoriaServicio.findMany = async () => {
    throw new Error("BD caída");
  };
  try {
    const res = await catalogoRoute.GET();
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, "SERVER_ERROR");
  } finally {
    mock.categoriaServicio.findMany = original;
  }
});
