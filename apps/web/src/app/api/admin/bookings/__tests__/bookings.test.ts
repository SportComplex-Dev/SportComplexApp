/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const { createMockPrisma } = await import("@db-test/mock-prisma");
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;
Reflect.set(process.env, "NODE_ENV", "test");

const adminId = "00000000-0000-4000-8000-000000000021";
mock._state.usuarios.push({
  id: adminId,
  nombre: "Admin Reservas",
  correo: "admin.reservas@sportcomplex.com",
  estado: "ACTIVO",
  deletedAt: null,
  rolId: 1,
  rolNombre: "ADMINISTRADOR",
});
(globalThis as any).__scAuthSession = { user: { id: adminId } };

const bookingsRoute = await import("@/app/api/admin/bookings/route");

test("TSK-BE-27 / SCRUM-212: GET /api/admin/bookings rechaza roles sin permiso (403)", async () => {
  const admin = mock._state.usuarios.find((u: { id: string }) => u.id === adminId)!;
  admin.rolNombre = "CLIENTE";
  const forbidden = await bookingsRoute.GET(
    new Request("http://localhost:3000/api/admin/bookings"),
  );
  assert.equal(forbidden.status, 403);
  const body = await forbidden.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "FORBIDDEN");

  admin.rolNombre = "ADMINISTRADOR";
});

test("TSK-BE-27 / SCRUM-212: GET /api/admin/bookings valida query params (400)", async () => {
  const invalidDate = await bookingsRoute.GET(
    new Request("http://localhost:3000/api/admin/bookings?dateFrom=2026/10/15"),
  );
  assert.equal(invalidDate.status, 400);
  const body = await invalidDate.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "VALIDATION_ERROR");

  const invalidLimit = await bookingsRoute.GET(
    new Request("http://localhost:3000/api/admin/bookings?limit=-5"),
  );
  assert.equal(invalidLimit.status, 400);
});

test("TSK-BE-27 / SCRUM-212: GET /api/admin/bookings responde con contrato canónico para rol Administrador", async () => {
  const response = await bookingsRoute.GET(
    new Request("http://localhost:3000/api/admin/bookings?limit=10&offset=0"),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.items));
  assert.equal(typeof body.data.total, "number");
  assert.equal(typeof body.data.metrics, "object");
  assert.equal(typeof body.data.metrics.todayTotal, "number");
  assert.equal(typeof body.data.metrics.confirmedCount, "number");
  assert.equal(typeof body.data.metrics.pendingCount, "number");
  assert.ok(Array.isArray(body.data.metrics.byService));
});
