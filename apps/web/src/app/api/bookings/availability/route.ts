import { BookingError, getBookableAvailability, getServicios } from "@sportcomplex/db";
import { fail, ok } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/bookings/availability
 * Consulta disponibilidad de franjas para una fecha dada (y opcionalmente un servicioId).
 * Soporta parámetros tanto en español (?fecha=, ?servicioId=) como en inglés (?date=, ?serviceId=).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("fecha") || searchParams.get("date");
  const rawServiceId = searchParams.get("servicioId") || searchParams.get("serviceId");

  if (!rawDate) {
    return fail("VALIDATION_ERROR", "El parámetro 'fecha' es obligatorio (formato YYYY-MM-DD).", 400);
  }

  try {
    if (rawServiceId) {
      const serviceId = parseInt(rawServiceId, 10);
      if (isNaN(serviceId)) {
        return fail("VALIDATION_ERROR", "El 'servicioId' debe ser un número entero válido.", 400);
      }
      const availability = await getBookableAvailability(serviceId, rawDate);
      return ok(availability);
    }

    // Si no se especifica servicioId, consultar disponibilidad para todos los servicios activos
    const activeServices = await getServicios({ estado: "ACTIVO" });
    const results = await Promise.all(
      activeServices.map(async (service) => {
        try {
          const slots = await getBookableAvailability(service.id, rawDate);
          return { serviceId: service.id, serviceName: service.nombre, slots };
        } catch {
          return { serviceId: service.id, serviceName: service.nombre, slots: [] };
        }
      })
    );

    return ok(results);
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/bookings/availability:", error);
    return fail("SERVER_ERROR", "Error al consultar disponibilidad.", 500);
  }
}
