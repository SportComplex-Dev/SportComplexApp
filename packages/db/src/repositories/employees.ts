import { prisma } from "../client";
import type { EstadoUsuario } from "@prisma/client";

const EMPLOYEE_ROLES = new Set([
  "VENDEDOR",
  "EMPLEADO_VENDEDOR",
  "LECTOR",
  "EMPLEADO_LECTOR",
]);

export class EmployeeError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EmployeeError";
  }
}

export interface EmployeeDeactivationResult {
  id: string;
  estado: "INACTIVO";
  deletedAt: Date;
  role: string;
}

interface EmployeeDatabase {
  usuario: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        estado: true;
        deletedAt: true;
        rolId: true;
        rol: { select: { nombre: true } };
      };
    }): Promise<{
      id: string;
      estado: EstadoUsuario;
      deletedAt: Date | null;
      rolId: number;
      rol: { nombre: string } | null;
    } | null>;
    updateMany(args: {
      where: {
        id: string;
        rolId: number;
        estado: EstadoUsuario;
        deletedAt: Date | null;
      };
      data: { estado: "INACTIVO"; deletedAt: Date };
    }): Promise<{ count: number }>;
  };
}

/**
 * Baja lógica de un empleado: conserva el usuario y sus relaciones históricas.
 */
export async function deactivateEmployee(
  employeeId: string,
  options: {
    db?: EmployeeDatabase;
    now?: Date;
  } = {},
): Promise<EmployeeDeactivationResult> {
  if (!employeeId.trim()) {
    throw new EmployeeError("Falta el ID del empleado.", "INVALID_ID", 400);
  }

  const db: EmployeeDatabase = options.db ?? prisma;
  const employee = await db.usuario.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      estado: true,
      deletedAt: true,
      rolId: true,
      rol: { select: { nombre: true } },
    },
  });
  const role = typeof employee?.rol?.nombre === "string"
    ? employee.rol.nombre.trim().toUpperCase()
    : "";

  if (!employee || !EMPLOYEE_ROLES.has(role)) {
    throw new EmployeeError("Empleado no encontrado.", "EMPLOYEE_NOT_FOUND", 404);
  }

  if (employee.estado === "INACTIVO" && employee.deletedAt) {
    return {
      id: employee.id,
      estado: "INACTIVO",
      deletedAt: employee.deletedAt,
      role,
    };
  }

  const deletedAt = options.now ?? new Date();
  const updated = await db.usuario.updateMany({
    where: {
      id: employeeId,
      rolId: employee.rolId,
      estado: employee.estado,
      deletedAt: employee.deletedAt,
    },
    data: { estado: "INACTIVO", deletedAt },
  });
  if (updated.count !== 1) {
    throw new EmployeeError(
      "El empleado cambió durante la baja; vuelve a intentarlo.",
      "EMPLOYEE_UPDATE_CONFLICT",
      409,
    );
  }

  return { id: employee.id, estado: "INACTIVO", deletedAt, role };
}
