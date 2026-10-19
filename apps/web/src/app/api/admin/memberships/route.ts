import { listAdminMembershipOverview } from "@sportcomplex/db";
import { fail, ok } from "@sportcomplex/shared/lib";
import { authorizeApiRequest } from "@/lib/api/api-auth";

/**
 * GET /api/admin/memberships
 * Segmenta clientes según sus membresías y devuelve indicadores resumidos.
 * Solo expone identificador, nombre y fechas necesarias para gestionar la membresía.
 */
export async function GET() {
  const authorization = await authorizeApiRequest(["Administrador"]);
  if (!authorization.authorized) return authorization.response;

  try {
    return ok(await listAdminMembershipOverview());
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/memberships:", error);
    return fail("SERVER_ERROR", "No se pudo consultar la segmentación de membresías.", 500);
  }
}
