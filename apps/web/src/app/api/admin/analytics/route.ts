import { fail, ok } from "@/lib/api-response";
import {
  analyticsQuerySchema,
  normalizeAnalyticsQuery,
} from "@sportcomplex/validation";
import { getAnalytics } from "@sportcomplex/db";

/**
 * GET /api/admin/analytics
 * Endpoint de agregaciones analíticas gerenciales (RF-21 / TSK-BE-24).
 * Apoyado en el modelo analítico de PostgreSQL (vw_kpi_*).
 * Parámetros opcionales:
 * - startDate / from / fechaInicio: YYYY-MM-DD
 * - endDate / to / fechaFin: YYYY-MM-DD
 * - period / periodo: "daily" | "weekly" (por defecto "daily")
 *
 * Zona horaria estándar: America/Bogota (UTC-5).
 * Criterio de aceptación: respuesta en < 2 s con dataset TSK-BD-03 y cifras
 * cuadradas con COUNT directo sobre tablas transaccionales.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const rawQuery = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      fechaInicio: searchParams.get("fechaInicio") || undefined,
      fechaFin: searchParams.get("fechaFin") || undefined,
      period: searchParams.get("period") || undefined,
      periodo: searchParams.get("periodo") || undefined,
    };

    const parsed = analyticsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message || "Parámetros de consulta analítica inválidos";
      return fail("VALIDATION_ERROR", firstIssue, 400, parsed.error.format());
    }

    const filters = normalizeAnalyticsQuery(parsed.data);
    const data = await getAnalytics(filters);

    return ok(data);
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/analytics:", error);
    return fail("SERVER_ERROR", "Error al consultar agregaciones analíticas", 500);
  }
}
