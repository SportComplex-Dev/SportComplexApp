import { auth } from "@/auth";
import { BookingError, createBookingHold, getBookableAvailability } from "@sportcomplex/db";
import { availabilityQuerySchema, bookingRequestSchema } from "@sportcomplex/validation";
import { created, fail, ok } from "@/lib/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Servicio o fecha inválidos.", 400, parsed.error.flatten());
  }

  try {
    return ok(await getBookableAvailability(parsed.data.serviceId, parsed.data.date));
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
    const session = await auth();
    if (!session?.user?.id) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión para reservar.", 401);
    }
    if (session.user.role?.toUpperCase() !== "CLIENTE" || session.user.estado !== "ACTIVO") {
      return fail("FORBIDDEN", "Solo una cuenta de cliente activa puede reservar en línea.", 403);
    }

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

    const reservation = await createBookingHold({
      ...parsed.data,
      userId: session.user.id,
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
