import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../test/mock-prisma";
import { deactivateEmployee, EmployeeError } from "./employees";

test("employee deactivation is logical and preserves sales and access history", async () => {
  const db = createMockPrisma();
  const employeeId = "00000000-0000-4000-8000-000000000001";
  const timestamp = new Date("2026-10-09T12:00:00.000Z");
  db._state.usuarios.push({
    id: employeeId,
    nombre: "Empleado",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "LECTOR",
  });
  db._state.tickets.push({
    id: "ticket-1",
    reservaId: "reserva-1",
    codigoUuid: "00000000-0000-4000-8000-000000000002",
    usadoPor: employeeId,
    estado: "USADO",
    usadoEn: timestamp,
  });
  db._state.lecturas.push({
    id: 1n,
    ticketId: "ticket-1",
    empleadoId: employeeId,
    asignacionId: null,
    modo: "TURNO",
    resultado: "CONCEDIDO",
    fechaHora: timestamp,
  });
  const ticketHistoryBefore = structuredClone(db._state.tickets);
  const scanHistoryBefore = structuredClone(db._state.lecturas);

  const result = await deactivateEmployee(employeeId, { db, now: timestamp });

  assert.equal(result.estado, "INACTIVO");
  assert.equal(result.deletedAt, timestamp);
  assert.equal(db._state.usuarios[0].estado, "INACTIVO");
  assert.equal(db._state.usuarios[0].deletedAt, timestamp);
  assert.deepEqual(db._state.tickets, ticketHistoryBefore);
  assert.deepEqual(db._state.lecturas, scanHistoryBefore);

  const retry = await deactivateEmployee(employeeId, { db });
  assert.deepEqual(retry, result);
});

test("employee deactivation refuses non-employee accounts", async () => {
  const db = createMockPrisma();
  db._state.usuarios.push({
    id: "00000000-0000-4000-8000-000000000003",
    nombre: "Admin",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 1,
    rolNombre: "ADMINISTRADOR",
  });

  await assert.rejects(
    () => deactivateEmployee(db._state.usuarios[0].id, { db }),
    (error: unknown) =>
      error instanceof EmployeeError &&
      error.code === "EMPLOYEE_NOT_FOUND" &&
      error.status === 404,
  );
  assert.equal(db._state.usuarios[0].estado, "ACTIVO");
});
