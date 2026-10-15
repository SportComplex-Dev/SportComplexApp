import { authorizeApiRequest } from "@/lib/api/api-auth";
import { fail, ok, created } from '@sportcomplex/shared/lib';
import {
  listEmployees,
  createEmployee,
  EmployeeError,
} from "@sportcomplex/db";
import { createEmployeeSchema } from "@sportcomplex/validation";
import { hashSecret } from "@sportcomplex/security";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

const DUPLICATE_EMAIL_HINT =
  /already been registered|already registered|already been taken|user_already_exists|email_exists/i;

/**
 * GET /api/admin/employees
 * Lista el personal y empleados con su rol y estado (RF-18 / TSK-FE-21).
 * Soporta parámetros de consulta limit, offset y page (PERF-01).
 * Nunca expone password_hash en la respuesta.
 */
export async function GET(request?: Request) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    let limit: number | undefined;
    let offset: number | undefined;
    let page: number | undefined;

    if (request && request.url) {
      const url = new URL(request.url);
      const limitParam = url.searchParams.get("limit");
      const offsetParam = url.searchParams.get("offset");
      const pageParam = url.searchParams.get("page");

      if (limitParam !== null) limit = parseInt(limitParam, 10);
      if (offsetParam !== null) offset = parseInt(offsetParam, 10);
      if (pageParam !== null) page = parseInt(pageParam, 10);
    }

    const employees = await listEmployees({
      ...(limit !== undefined && !Number.isNaN(limit) ? { limit } : {}),
      ...(offset !== undefined && !Number.isNaN(offset) ? { offset } : {}),
      ...(page !== undefined && !Number.isNaN(page) ? { page } : {}),
    });
    return ok(employees);
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/employees:", error);
    return fail("SERVER_ERROR", "No se pudo consultar el listado de empleados.", 500);
  }
}

/**
 * POST /api/admin/employees
 * Alta de empleado con asignación de rol (ADMIN / VENDEDOR / LECTOR) (RF-18 / TSK-FE-21).
 * Tratamiento obligatorio de sincronización con Supabase Auth ante fallos o colisiones (SEC-04).
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
    const normalizedEmail = correo.trim().toLowerCase();

    // SEC-04: Si Supabase Auth está configurado, la sincronización es obligatoria.
    // Creamos primero la identidad en Supabase para evitar estados locales huérfanos o inconsistentes.
    let supabaseUserId: string | null = null;
    if (isSupabaseAdminConfigured()) {
      const supabase = createSupabaseAdminClient();
      const { data: sbData, error: sbError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { role: rolNombre, name: nombre },
      });

      if (sbError) {
        if (DUPLICATE_EMAIL_HINT.test(sbError.message ?? "")) {
          return fail(
            "EMAIL_ALREADY_EXISTS",
            "Ya existe un usuario registrado con este correo electrónico en el proveedor de autenticación.",
            409,
          );
        }
        console.error("Error al aprovisionar usuario en Supabase Auth:", sbError);
        return fail(
          "AUTH_SYNC_FAILED",
          "No se pudo sincronizar la cuenta con el proveedor de autenticación: " + sbError.message,
          502,
        );
      }

      supabaseUserId = sbData?.user?.id ?? null;
    }

    // Hashear la contraseña temporal con Argon2id de forma segura
    const passwordHash = await hashSecret(password);

    try {
      const newEmployee = await createEmployee({
        nombre,
        correo: normalizedEmail,
        rolNombre,
        passwordHash,
      });

      return created(newEmployee);
    } catch (dbError) {
      // Compensación: Si la inserción en base de datos falla, revertir la identidad en Supabase Auth
      if (supabaseUserId && isSupabaseAdminConfigured()) {
        try {
          const supabase = createSupabaseAdminClient();
          await supabase.auth.admin.deleteUser(supabaseUserId);
        } catch (compensationError) {
          console.error("Error al compensar usuario en Supabase Auth tras fallo en DB:", compensationError);
        }
      }
      throw dbError;
    }
  } catch (error: unknown) {
    if (error instanceof EmployeeError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/admin/employees:", error);
    return fail("SERVER_ERROR", "No se pudo registrar al empleado.", 500);
  }
}
