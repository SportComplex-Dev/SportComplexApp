import { authorizeApiRequest } from "@/lib/api/api-auth";
import { findActiveMembership, listMembershipPlans } from "@sportcomplex/db";
import { ok, fail } from '@sportcomplex/shared/lib';

/**
 * GET /api/memberships
 * Retorna el catálogo de planes de membresía activos (Semanal, Mensual, Anual)
 * y el estado de la membresía del usuario autenticado si hay sesión activa (RF-16 / RN-08).
 */
export async function GET() {
  try {
    const planes = await listMembershipPlans();

    // Verificación opcional de sesión para incluir membresía activa del usuario
    const authResult = await authorizeApiRequest(["Cliente", "Empleado_Vendedor", "Administrador"]).catch(() => null);

    let membresiaActiva = null;
    if (authResult && authResult.authorized) {
      membresiaActiva = await findActiveMembership(authResult.actor.id);
    }

    return ok({
      planes,
      membresiaActiva: membresiaActiva
        ? {
            id: membresiaActiva.id,
            estado: membresiaActiva.estado,
            fechaInicio: membresiaActiva.fechaInicio,
            proximaRenovacion: membresiaActiva.proximaRenovacion,
            plan: membresiaActiva.plan,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("Error en GET /api/memberships:", error);
    return fail("SERVER_ERROR", "Error al consultar los planes de membresía.", 500);
  }
}
