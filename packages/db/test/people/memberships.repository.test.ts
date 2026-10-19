import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../mock-prisma.ts";

const mock = createMockPrisma();
Reflect.set(globalThis, "__scPrisma", mock);

const { listAdminMembershipOverview } = await import(
  "../../src/repositories/people/memberships.ts"
);

const now = new Date("2026-10-18T16:00:00.000Z");

function addClient(id: string, nombre: string) {
  mock._state.usuarios.push({
    id,
    nombre,
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 4,
    rolNombre: "CLIENTE",
  });
}

function addMembership(
  id: number,
  usuarioId: string,
  estado: string,
  fechaInicio: string,
  proximaRenovacion: string,
) {
  mock._state.membresias.push({
    id,
    usuarioId,
    estado,
    fechaInicio: new Date(`${fechaInicio}T00:00:00.000Z`),
    proximaRenovacion: new Date(`${proximaRenovacion}T00:00:00.000Z`),
  });
}

test("segmenta membresías vencidas por fecha y excluye inicios futuros de nuevos socios", async () => {
  addClient("active", "Socia activa");
  addClient("stale", "Socio con estado pendiente de transición");
  addClient("future", "Membresía cancelada futura");
  addClient("renewed", "Socio renovado");
  addClient("none", "Cliente sin historial");

  addMembership(1, "active", "VIGENTE", "2026-10-01", "2026-10-18");
  addMembership(2, "stale", "VIGENTE", "2026-07-01", "2026-10-17");
  addMembership(3, "future", "CANCELADA", "2026-10-20", "2026-11-20");
  addMembership(4, "renewed", "CANCELADA", "2026-06-01", "2026-07-01");
  addMembership(5, "renewed", "VENCIDA", "2026-07-01", "2026-08-01");

  const result = await listAdminMembershipOverview(now, mock as never);

  assert.deepEqual(result.segments.active.map(({ id }) => id), ["active"]);
  assert.deepEqual(result.segments.none.map(({ id }) => id), ["none"]);
  assert.deepEqual(result.segments.expired.map(({ id }) => id), ["stale", "future", "renewed"]);
  assert.equal(result.metrics.newMembersLast30Days, 1);
  assert.equal(result.metrics.renewalPercentage, 25);
});
