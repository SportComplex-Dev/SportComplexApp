import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok, created } from "@/lib/api-response";
import {
  listEmployees,
  createEmployee,
  EmployeeError,
} from "@sportcomplex/db";
import { createEmployeeSchema } from "@sportcomplex/validation";
import { hashSecret } from "@sportcomplex/core/src/security/token";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

/**
 * GET /api/admin/employees
 * Lista el personal y empleados con su rol y estado (RF-18 / TSK-FE-21).
 * Nunca expone password_hash en la respuesta.
 */
export async function GET() {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const employees = await listEmployees();
    return ok(employees);
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/employees:", error);
    return fail("SERVER_ERROR", "No se pudo consultar el listado de empleados.", 500);
  }
}

/**
 * POST /api/admin/employees
 * Alta de empleado con asignación de rol (ADMIN / VENDEDOR / LECTOR) (RF-18 / TSK-FE-21).
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un JSON válido.", 400);
    }

    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]?.message ?? "Datos de empleado inválidos.";
      return fail("VALIDATION_ERROR", issue, 400, parsed.error.flatten());
    }

    const { nombre, correo, rolNombre, password } = parsed.data;

    // Hashear la contraseña temporal con Argon2id de forma segura
    const passwordHash = await hashSecret(password);

    const newEmployee = await createEmployee({
      nombre,
      correo,
      rolNombre,
      passwordHash,
    });

    // SEC-04: Sincronizar credenciales con Supabase Auth si está configurado
    if (isSupabaseAdminConfigured()) {
      try {
        const supabase = createSupabaseAdminClient();
        await supabase.auth.admin.createUser({
          email: correo.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: { role: rolNombre, name: nombre },
        });
      } catch (sbError) {
        console.warn("Advertencia: No se pudo sincronizar el usuario en Supabase Auth:", sbError);
      }
    }

    return created(newEmployee);
  } catch (error: unknown) {
    if (error instanceof EmployeeError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/admin/employees:", error);
    return fail("SERVER_ERROR", "No se pudo registrar al empleado.", 500);
  }
}
