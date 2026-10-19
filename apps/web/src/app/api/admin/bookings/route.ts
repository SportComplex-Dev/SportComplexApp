import { fail, ok } from "@sportcomplex/shared/lib";
import { authorizeApiRequest } from "@/lib/api/api-auth";
import { adminBookingsQuerySchema } from "@sportcomplex/validation";
import { listAdminBookings } from "@sportcomplex/db";

/**
 * GET /api/admin/bookings
 * Consulta administrativa consolidada de reservas deportivas (RF-21, TSK-BE-27).
 * Requiere rol Administrador.
 * Query params: limit, offset, status, serviceId, dateFrom, dateTo, search.
 */
export async function GET(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      if (value !== "") {
        queryParams[key] = value;
      }
    }

    const parsed = adminBookingsQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Parámetros de consulta de reservas inválidos.",
        400,
        parsed.error.flatten(),
      );
    }

    const data = await listAdminBookings(parsed.data);
    return ok(data);
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/bookings:", error);
    return fail("SERVER_ERROR", "Error al consultar las reservas administrativas.", 500);
  }
}
