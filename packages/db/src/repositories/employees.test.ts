import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../../test/mock-prisma";
import {
  deactivateEmployee,
  listEmployees,
  createEmployee,
  EmployeeError,
} from "./employees";

test("listEmployees retrieves employee accounts and orders by creadoEn desc", async () => {
  const db = createMockPrisma();
  db._state.usuarios.push(
    {
      id: "emp-1",
      nombre: "Empleado Taquilla",
      correo: "taquilla@sportcomplex.co",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 2,
      rolNombre: "VENDEDOR",
      creadoEn: new Date("2026-10-01T08:00:00Z"),
    },
    {
      id: "emp-2",
      nombre: "Empleado Acceso",
      correo: "acceso@sportcomplex.co",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 3,
      rolNombre: "LECTOR",
      creadoEn: new Date("2026-10-05T08:00:00Z"),
    },
    {
      id: "cli-1",
      nombre: "Cliente General",
      correo: "cliente@sportcomplex.co",
      estado: "ACTIVO",
      deletedAt: null,
      rolId: 4,
      rolNombre: "CLIENTE",
      creadoEn: new Date("2026-10-02T08:00:00Z"),
    },
  );

  const employees = await listEmployees({ db });
  assert.equal(employees.length, 2);
  assert.equal(employees[0].id, "emp-2");
  assert.equal(employees[1].id, "emp-1");
  assert.equal(employees[0].correo, "acceso@sportcomplex.co");
  assert.equal(employees[0].rol.nombre, "LECTOR");
});

test("createEmployee registers employee with normalized email and valid role", async () => {
  const db = createMockPrisma();
  const created = await createEmployee(
    {
      nombre: " Carlos Gomez ",
      correo: "  Carlos.Gomez@SportComplex.CO ",
      rolNombre: "EMPLEADO_VENDEDOR",
      passwordHash: "argon2id_mock_hash",
    },
    { db },
  );

  assert.equal(created.nombre, "Carlos Gomez");
  assert.equal(created.correo, "carlos.gomez@sportcomplex.co");
  assert.equal(created.rol.id, 2);
  assert.equal(created.rol.nombre, "VENDEDOR");
  assert.equal(created.estado, "ACTIVO");
});

test("createEmployee rejects duplicate emails even with different casing (SEC-02)", async () => {
  const db = createMockPrisma();
  db._state.usuarios.push({
    id: "existing-1",
    nombre: "Usuario Existente",
    correo: "usuario@sportcomplex.co",
    estado: "ACTIVO",
    deletedAt: null,
    rolId: 2,
    rolNombre: "VENDEDOR",
  });

  await assert.rejects(
    () =>
      createEmployee(
        {
          nombre: "Nuevo Usuario",
          correo: "  USUARIO@SPORTCOMPLEX.CO  ",
          rolNombre: "VENDEDOR",
          passwordHash: "hash123",
        },
        { db },
      ),
    (err: unknown) =>
      err instanceof EmployeeError &&
      err.code === "EMAIL_ALREADY_EXISTS" &&
      err.status === 409,
  );
});

test("createEmployee rejects non-existent roles without creating them dynamically (SEC-03)", async () => {
  const db = createMockPrisma();

  await assert.rejects(
    () =>
      createEmployee(
        {
          nombre: "Empleado Falso",
          correo: "falso@sportcomplex.co",
          rolNombre: "ROL_INEXISTENTE_HACK",
          passwordHash: "hash123",
        },
        { db },
      ),
    (err: unknown) =>
      err instanceof EmployeeError &&
      err.code === "ROLE_NOT_FOUND" &&
      err.status === 400,
  );
});

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
