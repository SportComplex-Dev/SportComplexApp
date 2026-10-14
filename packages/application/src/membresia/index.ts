import type { Membresia } from "@sportcomplex/domain/membresia";
import { aplicarDescuentoMembresia } from "../precio/index.js";

export class MembresiaInvarianteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "MembresiaInvarianteError";
  }
}

/**
 * Valida si una membresía está activa y vigente para una fecha dada (por defecto ahora).
 */
export function validarMembresia(
  membresia: Partial<Membresia> | null | undefined,
  now: Date = new Date(),
): { vigente: boolean; razon?: string } {
  if (!membresia) {
    return { vigente: false, razon: "MEMBERSHIP_NOT_FOUND" };
  }

  if (membresia.estado !== "VIGENTE") {
    return { vigente: false, razon: `MEMBERSHIP_STATE_${membresia.estado}` };
  }

  if (membresia.fechaFin) {
    const fin = new Date(membresia.fechaFin);
    if (fin.getTime() < now.getTime()) {
      return { vigente: false, razon: "MEMBERSHIP_EXPIRED" };
    }
  }

  if (membresia.fechaInicio) {
    const inicio = new Date(membresia.fechaInicio);
    if (inicio.getTime() > now.getTime()) {
      return { vigente: false, razon: "MEMBERSHIP_NOT_STARTED" };
    }
  }

  return { vigente: true };
}

/**
 * Aplica el descuento por membresía delegando a la lógica pura de precio.
 */
export function aplicarDescuento(
  montoOPrecio: number,
  membresiaOrActiva: Partial<Membresia> | boolean,
  now: Date = new Date(),
): number {
  const tieneMembresiaActiva =
    typeof membresiaOrActiva === "boolean"
      ? membresiaOrActiva
      : validarMembresia(membresiaOrActiva, now).vigente;

  return aplicarDescuentoMembresia(montoOPrecio, tieneMembresiaActiva);
}
