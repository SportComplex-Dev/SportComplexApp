import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok } from '@sportcomplex/shared/lib';
import { getServicios } from "@sportcomplex/db";

export async function GET() {
  try {
    const authorization = await authorizeApiRequest(["Administrador", "Empleado_Lector"]);
    if (!authorization.authorized) return authorization.response;

    const servicios = await getServicios({ estado: "ACTIVO" });
    return ok(servicios.map(({ id, nombre }) => ({ id, nombre })));
  } catch (error: unknown) {
    console.error("Error en GET /api/access/services:", error);
    return fail("SERVER_ERROR", "No se pudieron consultar los servicios de acceso.", 500);
  }
}
