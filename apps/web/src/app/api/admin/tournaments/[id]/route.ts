import { fail, ok } from '@sportcomplex/shared/lib';
import { authorizeApiRequest } from "@/lib/api-auth";
import {
  tournamentIdParamSchema,
  updateTournamentSchema,
} from "@sportcomplex/validation";
import {
  obtenerTorneoPorId,
  actualizarTorneo,
  eliminarTorneo,
  TournamentError,
} from "@sportcomplex/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/tournaments/[id]
 * Obtiene el detalle de un torneo con sus pistas bloqueadas e inscripciones de jugadores.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const parsedId = tournamentIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return fail("INVALID_ID", "El ID del torneo debe ser un UUID válido.", 400);
    }

    try {
      const torneo = await obtenerTorneoPorId(parsedId.data);
      return ok(torneo);
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error en GET /api/admin/tournaments/[id]:", error);
    return fail("SERVER_ERROR", "Error al consultar el detalle del torneo", 500);
  }
}

/**
 * PUT / PATCH /api/admin/tournaments/[id]
 * Actualiza los datos, estado o pistas asignadas de un torneo.
 */
async function handleUpdate(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const parsedId = tournamentIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return fail("INVALID_ID", "El ID del torneo debe ser un UUID válido.", 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    if (typeof rawBody !== "object" || rawBody === null) {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un objeto JSON", 400);
    }

    const parsed = updateTournamentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de actualización del torneo inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const updated = await actualizarTorneo(parsedId.data, parsed.data);
      return ok(updated);
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error al actualizar torneo:", error);
    return fail("SERVER_ERROR", "Error al actualizar el torneo", 500);
  }
}

export { handleUpdate as PUT, handleUpdate as PATCH };

/**
 * DELETE /api/admin/tournaments/[id]
 * Cancela o elimina el torneo y libera los bloqueos preventivos de pistas.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const parsedId = tournamentIdParamSchema.safeParse(id);
    if (!parsedId.success) {
      return fail("INVALID_ID", "El ID del torneo debe ser un UUID válido.", 400);
    }

    try {
      const resultado = await eliminarTorneo(parsedId.data);
      return ok(resultado);
    } catch (err: unknown) {
      if (err instanceof TournamentError) {
        return fail(err.code, err.message, err.status);
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error en DELETE /api/admin/tournaments/[id]:", error);
    return fail("SERVER_ERROR", "Error al cancelar o eliminar el torneo", 500);
  }
}

