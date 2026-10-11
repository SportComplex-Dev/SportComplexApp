import { prisma } from "../client";
import type { EstadoUsuario } from "@prisma/client";

export const ALL_EMPLOYEE_ROLES = [
  "ADMIN",
  "ADMINISTRADOR",
  "VENDEDOR",
  "EMPLEADO_VENDEDOR",
  "LECTOR",
  "EMPLEADO_LECTOR",
] as const;

const DEACTIVATABLE_ROLES = new Set([
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

export interface EmployeeItem {
  id: string;
  nombre: string;
  correo: string;
  estado: EstadoUsuario;
  creadoEn: Date;
  deletedAt: Date | null;
  rolId: number;
  rol: {
    id: number;
    nombre: string;
  };
}

export interface CreateEmployeeInputData {
  nombre: string;
  correo: string;
  rolNombre: string;
  passwordHash: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/**
 * Consulta y lista todos los empleados del sistema (ADMIN, VENDEDOR, LECTOR).
 * Nunca expone password_hash (seguridad RF-18 / RNF-02).
 */
export async function listEmployees(
  options: { db?: AnyDb } = {},
): Promise<EmployeeItem[]> {
  const db: AnyDb = options.db ?? prisma;
  const users = await db.usuario.findMany({
    where: {
      rol: {
        nombre: { in: [...ALL_EMPLOYEE_ROLES] },
      },
    },
    select: {
      id: true,
      nombre: true,
      correo: true,
      estado: true,
      creadoEn: true,
      deletedAt: true,
      rolId: true,
      rol: { select: { id: true, nombre: true } },
    },
    orderBy: { creadoEn: "desc" },
  });

  return users as EmployeeItem[];
}

/**
 * Registra un nuevo empleado con rol especificado.
 */
export async function createEmployee(
  data: CreateEmployeeInputData,
  options: { db?: AnyDb } = {},
): Promise<EmployeeItem> {
  const db: AnyDb = options.db ?? prisma;

  const existing = await db.usuario.findUnique({
    where: { correo: data.correo },
    select: { id: true },
  });

  if (existing) {
    throw new EmployeeError(
      "Ya existe un usuario registrado con este correo electrónico.",
      "EMAIL_ALREADY_EXISTS",
      409,
    );
  }

  // Normalizar nombre de rol si viene como alias
  let targetRolNombre = data.rolNombre.trim().toUpperCase();
  if (targetRolNombre === "ADMINISTRADOR") targetRolNombre = "ADMIN";
  if (targetRolNombre === "EMPLEADO_VENDEDOR") targetRolNombre = "VENDEDOR";
  if (targetRolNombre === "EMPLEADO_LECTOR") targetRolNombre = "LECTOR";

  let rol = await db.rol.findFirst({
    where: {
      OR: [
        { nombre: targetRolNombre },
        { nombre: data.rolNombre },
      ],
    },
    select: { id: true, nombre: true },
  });

  if (!rol) {
    // Si no existe, crear o buscar rol por defecto
    rol = await db.rol.create({
      data: { nombre: targetRolNombre },
      select: { id: true, nombre: true },
    });
  }

  const created = await db.usuario.create({
    data: {
      nombre: data.nombre.trim(),
      correo: data.correo.trim().toLowerCase(),
      rolId: rol.id,
      passwordHash: data.passwordHash,
      estado: "ACTIVO",
    },
    select: {
      id: true,
      nombre: true,
      correo: true,
      estado: true,
      creadoEn: true,
      deletedAt: true,
      rolId: true,
      rol: { select: { id: true, nombre: true } },
    },
  });

  return created as EmployeeItem;
}

/**
 * Baja lógica de un empleado (RN-10): conserva el usuario y sus relaciones históricas.
 */
export async function deactivateEmployee(
  employeeId: string,
  options: {
    db?: AnyDb;
    now?: Date;
  } = {},
): Promise<EmployeeDeactivationResult> {
  if (!employeeId || !employeeId.trim()) {
    throw new EmployeeError("Falta el ID del empleado.", "INVALID_ID", 400);
  }

  const db: AnyDb = options.db ?? prisma;
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

  if (!employee || (!DEACTIVATABLE_ROLES.has(role) && !role.includes("VENDEDOR") && !role.includes("LECTOR"))) {
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
