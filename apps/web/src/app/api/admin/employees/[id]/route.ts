import {
  deactivateEmployee,
  EmployeeManagementError,
} from "@sportcomplex/db";
import { authorizeApiRoles } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const denied = await authorizeApiRoles(["Administrador"]);
    if (denied) return denied;

    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return fail("INVALID_ID", "El ID del empleado no es válido.", 400);
    }

    return ok(await deactivateEmployee(id));
  } catch (error: unknown) {
    if (error instanceof EmployeeManagementError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en PATCH /api/admin/employees/[id]:", error);
    return fail("SERVER_ERROR", "No fue posible dar de baja al empleado.", 500);
  }
}
