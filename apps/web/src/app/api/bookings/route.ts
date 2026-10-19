import { authorizeApiRequest } from "@/lib/api/api-auth";
import { BookingError, createBookingHold, getReadOnlyBookableAvailability } from "@sportcomplex/db";
import { availabilityQuerySchema, bookingRequestSchema } from "@sportcomplex/validation";
import { created, fail, ok } from '@sportcomplex/shared/lib';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: searchParams.get("serviceId") || searchParams.get("servicioId"),
    date: searchParams.get("date") || searchParams.get("fecha"),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Servicio o fecha inválidos.", 400, parsed.error.flatten());
  }

  try {
    return ok(await getReadOnlyBookableAvailability(parsed.data.serviceId, parsed.data.date));
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/bookings:", error);
    return fail("SERVER_ERROR", "Error al consultar disponibilidades.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Cliente", "Empleado_Vendedor", "Administrador"]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }
    const parsed = bookingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de reserva inválidos.", 400, parsed.error.flatten());
    }

    const isStaff = authorization.actor.role === "Empleado_Vendedor" || authorization.actor.role === "Administrador";
    const titularId = isStaff ? (parsed.data.titularId ?? authorization.actor.id) : authorization.actor.id;
    const canal = isStaff ? (parsed.data.canal ?? "TAQUILLA") : "ONLINE";
    const vendedorId = isStaff ? authorization.actor.id : null;

    const reservation = await createBookingHold({
      ...parsed.data,
      userId: titularId,
      canal,
      vendedorId,
    });
    return created(reservation);
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/bookings:", error);
    return fail("SERVER_ERROR", "Error al procesar la reserva.", 500);
  }
}
