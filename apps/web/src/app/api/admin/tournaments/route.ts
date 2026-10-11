import { fail, ok, created } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import {
  createTournamentSchema,
  tournamentQuerySchema,
} from "@sportcomplex/validation";
import {
  crearTorneo,
  listarTorneos,
  TournamentError,
} from "@sportcomplex/db";

/**
 * GET /api/admin/tournaments
 * Lista todos los torneos registrados con filtros opcionales (estado, deporte/categoría, búsqueda).
 */
export async function GET(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const queryObj: Record<string, string | undefined> = {
      estado: searchParams.get("estado") || undefined,
      categoriaId: searchParams.get("categoriaId") || undefined,
      search: searchParams.get("search") || undefined,
      soloActivos: searchParams.get("soloActivos") || undefined,
    };

    const parsed = tournamentQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Parámetros de consulta inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    const torneos = await listarTorneos(parsed.data);
    return ok(torneos);
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/tournaments:", error);
    return fail("SERVER_ERROR", "Error al consultar los torneos", 500);
  }
}

/**
 * POST /api/admin/tournaments
 * Crea un torneo deportivo con asignación de pistas y motor de bloqueo preventivo de franjas.
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const rawBody = await request.json().catch(() => ({}));
    if (typeof rawBody !== "object" || rawBody === null) {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un objeto JSON", 400);
    }

    const parsed = createTournamentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos del torneo inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const torneo = await crearTorneo({
        ...parsed.data,
        adminId: authorization.actor.id,
      });
      return created(torneo);
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error en POST /api/admin/tournaments:", error);
    return fail("SERVER_ERROR", "Error al crear el torneo", 500);
  }
}
