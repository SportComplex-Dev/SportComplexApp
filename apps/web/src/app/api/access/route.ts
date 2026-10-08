import { fail } from "@/lib/api-response";
import { authorizeApiRoles } from "@/lib/api-auth";

// RF-13/RF-14/RF-15 — valida HMAC antes de DB, puesto/consulta, ventana horaria
export async function POST() {
  try {
    const denied = await authorizeApiRoles(["Administrador", "Empleado_Lector"]);
    if (denied) return denied;
    return fail("NOT_IMPLEMENTED", "Validación QR pendiente (feature/scanner-access-modes)", 501);
  } catch (error: unknown) {
    console.error("Error en POST /api/access:", error);
    return fail("SERVER_ERROR", "No fue posible validar el acceso.", 500);
  }
}
