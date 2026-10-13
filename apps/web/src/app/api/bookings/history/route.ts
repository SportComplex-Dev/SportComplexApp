import {
  BookingError,
  getBookingHistory,
  type BookingHistoryState,
} from "@sportcomplex/db";
import { fail, ok } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";

const historyStates = new Set<BookingHistoryState>([
  "CONFIRMADA",
  "EXPIRADA",
  "CANCELADA_ADMINISTRATIVA",
]);

export async function GET(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Cliente"]);
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("status");
    if (!estado || !historyStates.has(estado as BookingHistoryState)) {
      return fail(
        "VALIDATION_ERROR",
        "El filtro status debe ser CONFIRMADA, EXPIRADA o CANCELADA_ADMINISTRATIVA.",
        400,
      );
    }

    const rawLimit = searchParams.get("limit");
    const limit = rawLimit === null ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      return fail("INVALID_LIMIT", "El límite debe estar entre 1 y 50.", 400);
    }

    return ok(
      await getBookingHistory({
        userId: authorization.actor.id,
        estado: estado as BookingHistoryState,
        cursor: searchParams.get("cursor") ?? undefined,
        limit,
      }),
    );
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/bookings/history:", error);
    return fail("SERVER_ERROR", "Error al consultar el historial de reservas.", 500);
  }
}
