import { fail, ok } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import { tournamentIdParamSchema } from "@sportcomplex/validation";
import { obtenerTorneoPorId, prisma, TournamentError } from "@sportcomplex/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tournaments/[id]
 * Detalle público/cliente de un torneo específico, sus pistas asignadas,
 * conteo en tiempo real de cupos disponibles y estado de inscripción del socio (RF-15 / RNF-01).
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedId = tournamentIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return fail("INVALID_ID", "El ID del torneo debe ser un UUID válido.", 400);
    }

    try {
      const torneo = await obtenerTorneoPorId(parsedId.data);

      const cuposDisponibles = Math.max(0, torneo.cuposTotales - torneo.cuposOcupados);
      const inscripcionesAbiertas =
        torneo.estado === "INSCRIPCIONES_ABIERTAS" && cuposDisponibles > 0;

      // Verificación opcional de sesión para adjuntar inscripción del usuario actual
      const authResult = await authorizeApiRequest([
        "Cliente",
        "Administrador",
      ]).catch(() => null);

      let miInscripcion = null;
      if (authResult && authResult.authorized) {
        miInscripcion = await prisma.inscripcionTorneo.findUnique({
          where: {
            torneoId_usuarioId: {
              torneoId: torneo.id,
              usuarioId: authResult.actor.id,
            },
          },
          include: {
            usuario: { select: { id: true, nombre: true, correo: true } },
          },
        });
      }

      // No exponer lista completa de inscripciones ajenas en endpoint de cliente
      const torneoData = { ...torneo } as Record<string, unknown>;
      delete torneoData.inscripciones;

      return ok({
        ...torneoData,
        cuposDisponibles,
        inscripcionesAbiertas,
        yaInscrito: Boolean(miInscripcion),
        miInscripcion: miInscripcion ?? null,
      });
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error en GET /api/tournaments/[id]:", error);
    return fail("SERVER_ERROR", "Error al consultar el detalle del torneo", 500);
  }
}
