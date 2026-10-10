import { BookingError, getReadOnlyBookableAvailability } from "@sportcomplex/db";
import { availabilityQuerySchema } from "@sportcomplex/validation";
import { fail, ok } from "@/lib/api-response";
import { authorizeBotApiKey } from "@/lib/bot-api-auth";

export async function GET(request: Request) {
  const unauthorized = authorizeBotApiKey(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Servicio o fecha inválidos.", 400, parsed.error.flatten());
  }

  try {
    return ok(
      await getReadOnlyBookableAvailability(
        parsed.data.serviceId,
        parsed.data.date,
      ),
    );
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/v1/bot/availability:", error);
    return fail("SERVER_ERROR", "Error al consultar disponibilidades.", 500);
  }
}
