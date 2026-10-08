import type { EstadoUsuario } from "@prisma/client";
import { prisma } from "../client";

export class EmployeeManagementError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "NOT_EMPLOYEE",
    readonly status: number,
  ) {
    super(message);
    this.name = "EmployeeManagementError";
  }
}

function isEmployeeRole(roleName: string): boolean {
  const role = roleName.trim().toUpperCase().replaceAll(" ", "_");
  return ["VENDEDOR", "LECTOR", "EMPLEADO_VENDEDOR", "EMPLEADO_LECTOR"].includes(role);
}

export async function deactivateEmployee(userId: string) {
  const employee = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { id: true, rol: { select: { nombre: true } } },
  });
  if (!employee) {
    throw new EmployeeManagementError("Empleado no encontrado.", "NOT_FOUND", 404);
  }
  if (!isEmployeeRole(employee.rol.nombre)) {
    throw new EmployeeManagementError(
      "Solo se pueden dar de baja cuentas con rol de empleado.",
      "NOT_EMPLOYEE",
      409,
    );
  }

  return prisma.usuario.update({
    where: { id: userId },
    data: {
      estado: "INACTIVO" satisfies EstadoUsuario,
      deletedAt: new Date(),
    },
    select: { id: true, estado: true, deletedAt: true },
  });
}
