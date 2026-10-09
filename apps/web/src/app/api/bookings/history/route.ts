import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  BookingError,
  getBookingHistory,
  prisma,
  type BookingHistoryState,
} from "@sportcomplex/db";
import { fail, ok } from "@/lib/api-response";
import { normalizeRole } from "@/lib/session";

const historyStates = new Set<BookingHistoryState>([
  "CONFIRMADA",
  "EXPIRADA",
  "CANCELADA_ADMINISTRATIVA",
]);

export async function GET(request: Request) {
  try {
    const session = await auth();
    let userId = session?.user?.id;

    if (!userId) {
      const cookieStore = await cookies();
      const scSession = cookieStore.get("sc-session")?.value;
      if (scSession) {
        try {
          const parsed = JSON.parse(decodeURIComponent(scSession));
          userId = parsed.userId || parsed.id;
        } catch {
          try {
            const parsed = JSON.parse(scSession);
            userId = parsed.userId || parsed.id;
          } catch {}
        }
      }
    }

    if (!userId) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión.", 401);
    }

    const account = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        estado: true,
        deletedAt: true,
        rol: { select: { nombre: true } },
      },
    });
    if (
      !account ||
      account.deletedAt ||
      account.estado !== "ACTIVO" ||
      normalizeRole(account.rol.nombre) !== "Cliente"
    ) {
      return fail(
        "FORBIDDEN",
        "Solo una cuenta de cliente activa puede consultar su historial.",
        403,
      );
    }

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
        userId,
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
