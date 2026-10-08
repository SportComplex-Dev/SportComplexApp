import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { deactivateEmployee, EmployeeManagementError } = await import(
  "../src/repositories/employees.ts"
);

test("TSK-BE-21: la baja lógica inactiva al empleado y preserva ventas y escaneos", async () => {
  const employeeId = "00000000-0000-4000-8000-000000000021";
  mock._state.usuarios.push({
    id: employeeId,
    estado: "ACTIVO",
    deletedAt: null,
    rol: { nombre: "LECTOR" },
  });
  mock._state.pagos.push({ usuarioId: employeeId });
  mock._state.lecturasAcceso.push({ empleadoId: employeeId });
  mock._state.reservas.push({
    id: "00000000-0000-4000-8000-000000000022",
    titularId: employeeId,
    disponibilidadId: 1n,
    estado: "CONFIRMADA",
  });

  const result = await deactivateEmployee(employeeId);

  assert.equal(result.estado, "INACTIVO");
  assert.ok(result.deletedAt instanceof Date);
  assert.equal(mock._state.pagos.length, 1);
  assert.equal(mock._state.lecturasAcceso.length, 1);
  assert.equal(mock._state.reservas.length, 1);
});

test("TSK-BE-21: no permite usar baja de empleado sobre una cuenta cliente", async () => {
  const customerId = "00000000-0000-4000-8000-000000000023";
  mock._state.usuarios.push({
    id: customerId,
    estado: "ACTIVO",
    deletedAt: null,
    rol: { nombre: "CLIENTE" },
  });

  await assert.rejects(
    deactivateEmployee(customerId),
    (error: unknown) =>
      error instanceof EmployeeManagementError && error.code === "NOT_EMPLOYEE",
  );
  assert.equal(
    mock._state.usuarios.find((user: { id: string }) => user.id === customerId)?.estado,
    "ACTIVO",
  );
});
