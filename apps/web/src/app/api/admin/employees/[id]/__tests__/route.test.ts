import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../../../../../../../../packages/db/test/mock-prisma";

Reflect.set(process.env, "NODE_ENV", "test");
const empleadoId = "00000000-0000-4000-8000-000000000011";
const adminId = "00000000-0000-4000-8000-000000000012";
const db = createMockPrisma();
(globalThis as typeof globalThis & { __scPrisma: unknown }).__scPrisma = db;
(globalThis as typeof globalThis & {
  __scAuthSession: { user: { id: string } };
}).__scAuthSession = { user: { id: adminId } };

const route = await import("../route");

test("PATCH employee endpoint deactivates a staff account without deleting audit history", async () => {
  db._state.usuarios.push(
    {
      id: adminId,
      nombre: "Admin",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 1,
      rolNombre: "ADMINISTRADOR",
    },
    {
      id: empleadoId,
      nombre: "Lector",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "LECTOR",
    },
    { id: "client-1", nombre: "Cliente" },
  );
  db._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: "00000000-0000-4000-8000-000000000013",
    usadoPor: empleadoId,
    estado: "USADO",
    usadoEn: new Date("2026-10-01T10:00:00.000Z"),
  });
  db._state.lecturas.push({
    id: 1n,
    ticketId: "ticket-1",
    empleadoId,
    asignacionId: null,
    modo: "TURNO",
    resultado: "CONCEDIDO",
    fechaHora: new Date("2026-10-01T10:00:00.000Z"),
  });

  const readsBefore = structuredClone(db._state.lecturas);
  const ticketsBefore = structuredClone(db._state.tickets);
  const response = await route.PATCH(
    new Request(`http://localhost/api/admin/employees/${empleadoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ estado: "INACTIVO" }),
    }),
    { params: Promise.resolve({ id: empleadoId }) },
  );
  const body = await response.json();

  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.data.estado, "INACTIVO");
  assert.equal(db._state.usuarios.find((user: { id: string }) => user.id === empleadoId)?.estado, "INACTIVO");
  assert.deepEqual(db._state.lecturas, readsBefore);
  assert.deepEqual(db._state.tickets, ticketsBefore);
});
