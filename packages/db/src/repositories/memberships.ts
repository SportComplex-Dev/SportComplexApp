import { prisma } from "../client";
import { EstadoMembresia, PeriodicidadPlan } from "@prisma/client";

export class MembershipError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "MembershipError";
  }
}

/**
 * Calcula la fecha de la próxima renovación según la periodicidad del plan.
 * SEMANAL: +7 días.
 * MENSUAL: +1 mes calendario.
 * ANUAL: +1 año calendario.
 */
export function calculateRenewalDate(
  fromDate: Date = new Date(),
  periodicidad: PeriodicidadPlan | "SEMANAL" | "MENSUAL" | "ANUAL",
): Date {
  const next = new Date(fromDate);
  switch (periodicidad) {
    case "SEMANAL":
    case PeriodicidadPlan.SEMANAL:
      next.setDate(next.getDate() + 7);
      break;
    case "MENSUAL":
    case PeriodicidadPlan.MENSUAL:
      next.setMonth(next.getMonth() + 1);
      break;
    case "ANUAL":
    case PeriodicidadPlan.ANUAL:
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

export interface CreateMembershipInput {
  usuarioId: string;
  planId: number;
  stripeSubscriptionId?: string | null;
  fechaInicio?: Date;
  proximaRenovacion?: Date;
  estado?: EstadoMembresia;
}

/**
 * Obtiene la membresía VIGENTE de un usuario (si existe), incluyendo datos de su plan.
 */
export async function findActiveMembership(usuarioId: string, db = prisma) {
  if (!usuarioId?.trim()) return null;
  return db.membresia.findFirst({
    where: {
      usuarioId,
      estado: EstadoMembresia.VIGENTE,
    },
    include: {
      plan: true,
    },
  });
}

/**
 * Lista todos los planes de membresía activos disponibles en el complejo deportivo.
 */
export async function listMembershipPlans(db = prisma) {
  return db.planMembresia.findMany({
    where: { activo: true },
    orderBy: { id: "asc" },
  });
}

/**
 * Crea una membresía garantizando la unicidad de membresía VIGENTE por usuario (TSK-BD-11 / RF-16).
 */
export async function createMembership(
  input: CreateMembershipInput,
  db = prisma,
) {
  if (!input.usuarioId?.trim()) {
    throw new MembershipError("Falta usuarioId.", "VALIDATION_ERROR", 400);
  }
  if (!input.planId || input.planId <= 0) {
    throw new MembershipError("Plan inválido.", "VALIDATION_ERROR", 400);
  }

  const plan = await db.planMembresia.findUnique({
    where: { id: input.planId },
  });
  if (!plan || !plan.activo) {
    throw new MembershipError("El plan especificado no existe o no está activo.", "PLAN_NOT_FOUND", 404);
  }

  const estado = input.estado ?? EstadoMembresia.VIGENTE;
  if (estado === EstadoMembresia.VIGENTE) {
    const vigenteExistente = await db.membresia.findFirst({
      where: {
        usuarioId: input.usuarioId,
        estado: EstadoMembresia.VIGENTE,
      },
    });
    if (vigenteExistente) {
      throw new MembershipError(
        "El usuario ya cuenta con una membresía vigente activa.",
        "DUPLICATE_ACTIVE_MEMBERSHIP",
        409,
      );
    }
  }

  const fechaInicio = input.fechaInicio ?? new Date();
  const proximaRenovacion =
    input.proximaRenovacion ?? calculateRenewalDate(fechaInicio, plan.periodicidad);

  try {
    return await db.membresia.create({
      data: {
        usuarioId: input.usuarioId,
        planId: input.planId,
        estado,
        fechaInicio,
        proximaRenovacion,
        stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      },
      include: {
        plan: true,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      ("code" in err) &&
      ((err as { code: unknown }).code === "P2002" || (err as { code: unknown }).code === "23505")
    ) {
      throw new MembershipError(
        "El usuario ya cuenta con una membresía vigente activa.",
        "DUPLICATE_ACTIVE_MEMBERSHIP",
        409,
      );
    }
    throw err;
  }
}
