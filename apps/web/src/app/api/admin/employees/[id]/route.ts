import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";
import { deactivateEmployee, EmployeeError } from "@sportcomplex/db";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const deactivationSchema = z.object({
  estado: z.literal("INACTIVO"),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) {
      return fail("INVALID_ID", "El ID del empleado debe ser un UUID válido.", 400);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = deactivationSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "La baja debe establecer estado INACTIVO.", 400);
    }

    return ok(await deactivateEmployee(id));
  } catch (error: unknown) {
    if (error instanceof EmployeeError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en PATCH /api/admin/employees/[id]:", error);
    return fail("SERVER_ERROR", "No se pudo dar de baja al empleado.", 500);
  }
}
