import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "@db-test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const adminId = "00000000-0000-4000-8000-000000000032";
const db = createMockPrisma();
(globalThis as typeof globalThis & { __scPrisma: unknown }).__scPrisma = db;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } };
}).__scAuthSession = { user: { id: adminId } };

const route = await import("@/app/api/admin/memberships/route");

function seedData() {
  const now = new Date();
  const activeId = "00000000-0000-4000-8000-000000000033";
  const expiredId = "00000000-0000-4000-8000-000000000034";
  const noneId = "00000000-0000-4000-8000-000000000035";
  db._state.usuarios.length = 0;
  db._state.membresias.length = 0;
  db._state.usuarios.push(
    { id: adminId, nombre: "Administradora", estado: "ACTIVO", deletedAt: null, rolId: 1, rolNombre: "ADMINISTRADOR" },
    { id: activeId, nombre: "Socia Activa", correo: "privado@example.com", estado: "ACTIVO", deletedAt: null, rolId: 4, rolNombre: "CLIENTE" },
    { id: expiredId, nombre: "Socio Vencido", estado: "ACTIVO", deletedAt: null, rolId: 4, rolNombre: "CLIENTE" },
    { id: noneId, nombre: "Cliente Ocasional", estado: "ACTIVO", deletedAt: null, rolId: 4, rolNombre: "CLIENTE" },
    { id: "employee-id", nombre: "Personal", estado: "ACTIVO", deletedAt: null, rolId: 2, rolNombre: "VENDEDOR" },
  );
  db._state.membresias.push(
    { id: 1, usuarioId: activeId, estado: "VIGENTE", fechaInicio: now, proximaRenovacion: new Date(now.getTime() + 20 * 86400000) },
    { id: 2, usuarioId: expiredId, estado: "VENCIDA", fechaInicio: new Date(now.getTime() - 100 * 86400000), proximaRenovacion: new Date(now.getTime() - 70 * 86400000) },
    { id: 3, usuarioId: expiredId, estado: "CANCELADA", fechaInicio: new Date(now.getTime() - 60 * 86400000), proximaRenovacion: new Date(now.getTime() - 30 * 86400000) },
  );
  return { activeId, expiredId, noneId };
}

test("GET /api/admin/memberships exige rol administrador", async () => {
  seedData();
  const admin = db._state.usuarios.find((user: { id: string }) => user.id === adminId)!;
  admin.rolNombre = "CLIENTE";
  const response = await route.GET();
  assert.equal(response.status, 403);
  admin.rolNombre = "ADMINISTRADOR";
});

test("GET /api/admin/memberships segmenta clientes y limita los datos personales", async () => {
  const ids = seedData();
  const response = await route.GET();
  assert.equal(response.status, 200);
  const json = await response.json();

  assert.deepEqual(json.data.segments.active.map((member: { id: string }) => member.id), [ids.activeId]);
  assert.deepEqual(json.data.segments.none.map((member: { id: string }) => member.id), [ids.noneId]);
  assert.deepEqual(json.data.segments.expired.map((member: { id: string }) => member.id), [ids.expiredId]);
  assert.equal(json.data.metrics.newMembersLast30Days, 1);
  assert.equal(json.data.metrics.renewalPercentage, 50);
  assert.equal(JSON.stringify(json.data).includes("privado@example.com"), false);
  assert.equal(JSON.stringify(json.data).includes("passwordHash"), false);
});
