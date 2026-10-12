import { fail, ok } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import { tournamentQuerySchema } from "@sportcomplex/validation";
import { listarTorneos, prisma } from "@sportcomplex/db";

/**
 * GET /api/tournaments
 * Catálogo público/cliente de torneos deportivos con cálculo en tiempo real
 * de cupos disponibles y estado de inscripción para el usuario autenticado (RF-15 / RNF-01).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryObj: Record<string, string | undefined> = {
      estado: searchParams.get("estado") || undefined,
      categoriaId: searchParams.get("categoriaId") || undefined,
      search: searchParams.get("search") || undefined,
      soloActivos: searchParams.get("soloActivos") !== null ? searchParams.get("soloActivos")! : undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
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

    // Por defecto en el catálogo público, si no se especifica estado o soloActivos,
    // filtramos solo torneos activos (INSCRIPCIONES_ABIERTAS o EN_CURSO)
    const filtros = {
      ...parsed.data,
      soloActivos: parsed.data.estado ? undefined : (parsed.data.soloActivos ?? true),
    };

    const torneos = await listarTorneos(filtros);

    // Consulta opcional de sesión para indicar al usuario si ya está inscrito
    const authResult = await authorizeApiRequest([
      "Cliente",
      "Administrador",
    ]).catch(() => null);

    interface TorneoItem {
      id: string;
      cuposTotales: number;
      cuposOcupados: number;
      estado: string;
      [key: string]: unknown;
    }

    let inscripcionesUsuario: Set<string> = new Set();
    if (authResult && authResult.authorized) {
      const misInscripciones = await prisma.inscripcionTorneo.findMany({
        where: {
          usuarioId: authResult.actor.id,
          torneoId: { in: (torneos as TorneoItem[]).map((t: TorneoItem) => t.id) },
        },
      });
      inscripcionesUsuario = new Set(misInscripciones.map((i: { torneoId: string }) => i.torneoId));
    }

    const resultado = (torneos as TorneoItem[]).map((t: TorneoItem) => {
      const cuposDisponibles = Math.max(0, t.cuposTotales - t.cuposOcupados);
      const inscripcionesAbiertas =
        t.estado === "INSCRIPCIONES_ABIERTAS" && cuposDisponibles > 0;

      return {
        ...t,
        cuposDisponibles,
        inscripcionesAbiertas,
        yaInscrito: inscripcionesUsuario.has(t.id),
      };
    });

    return ok(resultado);
  } catch (error: unknown) {
    console.error("Error en GET /api/tournaments:", error);
    return fail("SERVER_ERROR", "Error al consultar los torneos disponibles", 500);
  }
}
