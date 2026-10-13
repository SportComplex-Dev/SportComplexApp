/**
 * Puerta de autorización por estado de cuenta (tabla `usuario`).
 * Puras para poder probarlas sin tocar Prisma ni Supabase (§5.8 del plan de auth).
 *
 * Reglas (contrato con DB):
 * - `PENDIENTE`        → ACCOUNT_PENDING (el frontend redirige a /verify)
 * - distinto de ACTIVO → ACCOUNT_INACTIVE
 * - borrado lógico     → ACCOUNT_INACTIVE aunque el estado diga ACTIVO
 */

export type AuthGateDecision =
  | { gate: "OK" }
  | {
      gate: "PENDING";
      code: "ACCOUNT_PENDING";
      message: string;
      status: 403;
    }
  | {
      gate: "INACTIVE";
      code: "ACCOUNT_INACTIVE";
      message: string;
      status: 403;
    };

export const ACCOUNT_PENDING_MESSAGE = "Verifica tu correo antes de ingresar.";
export const ACCOUNT_INACTIVE_MESSAGE = "Tu cuenta está inactiva.";

export function authGateFor(
  status: string | null | undefined,
  deleted: boolean,
): AuthGateDecision {
  if (deleted) {
    return {
      gate: "INACTIVE",
      code: "ACCOUNT_INACTIVE",
      message: ACCOUNT_INACTIVE_MESSAGE,
      status: 403,
    };
  }

  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "PENDIENTE") {
    return {
      gate: "PENDING",
      code: "ACCOUNT_PENDING",
      message: ACCOUNT_PENDING_MESSAGE,
      status: 403,
    };
  }

  if (normalized !== "ACTIVO") {
    return {
      gate: "INACTIVE",
      code: "ACCOUNT_INACTIVE",
      message: ACCOUNT_INACTIVE_MESSAGE,
      status: 403,
    };
  }

  return { gate: "OK" };
}