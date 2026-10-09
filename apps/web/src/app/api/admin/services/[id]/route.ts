import { fail, ok } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import {
  updateServicioSchema,
  normalizeServicePayload,
} from "@sportcomplex/validation";
import {
  getServicioById,
  updateServicio,
  deleteServicio,
} from "@sportcomplex/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/services/[id]
 * Obtiene el detalle de una instancia de servicio con su calendario.
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "El ID del servicio debe ser un número entero positivo", 400);
    }

    const servicio = await getServicioById(numId);
    if (!servicio) {
      return fail("NOT_FOUND", "Servicio no encontrado", 404);
    }

    return ok(servicio);
  } catch (error: unknown) {
    console.error("Error al obtener el servicio:", error);
    return fail("SERVER_ERROR", "Error al obtener el servicio", 500);
  }
}

/**
 * PUT / PATCH /api/admin/services/[id]
 * Actualiza una instancia de servicio, sus franjas y disponibilidad.
 */
async function handleUpdate(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "El ID del servicio debe ser un número entero positivo", 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    if (typeof rawBody !== "object" || rawBody === null) {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un objeto JSON", 400);
    }

    const normalized = normalizeServicePayload(rawBody);
    const parsed = updateServicioSchema.safeParse(normalized);

    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de actualización inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const updated = await updateServicio(numId, parsed.data);
      return ok(updated);
    } catch (err: unknown) {
      const error = err as {
        name?: string;
        code?: string;
        message?: string;
        meta?: { target?: string[] | string };
      };
      if (error.name === "NotFoundError") {
        return fail("NOT_FOUND", error.message || "Servicio no encontrado", 404);
      }
      if (error.name === "CapacityConflictError") {
        return fail(
          "CAPACITY_CONFLICT",
          error.message || "La capacidad no puede ser menor que los cupos ya ocupados en una franja.",
          409,
        );
      }
      const isDuplicateName =
        error.name === "DuplicateNameError" ||
        (error.code === "P2002" &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes("nombre")
            : typeof error.meta?.target === "string" &&
              (error.meta.target.includes("nombre") ||
                error.meta.target.includes("servicio_nombre_key"))));

      if (isDuplicateName) {
        return fail(
          "DUPLICATE_NAME",
          parsed.data.nombre
            ? `Ya existe otro servicio con el nombre "${parsed.data.nombre}" en el complejo.`
            : "Ya existe otro servicio con ese nombre",
          409,
        );
      }
      console.error("Error al actualizar el servicio:", err);
      return fail("SERVER_ERROR", "Error al actualizar el servicio", 500);
    }
  } catch (error: unknown) {
    console.error("Error al actualizar el servicio:", error);
    return fail("SERVER_ERROR", "Error al actualizar el servicio", 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  return handleUpdate(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleUpdate(request, context);
}

/**
 * DELETE /api/admin/services/[id]
 * Elimina una instancia de servicio respetando reservas activas existentes.
 * Soporta query param ?forceInactivate=true para inactivación preventiva.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "El ID del servicio debe ser un número entero positivo", 400);
    }

    const { searchParams } = new URL(request.url);
    const forceInactivate =
      searchParams.get("forceInactivate") === "true" ||
      searchParams.get("inactivate") === "true";

    try {
      const result = await deleteServicio(numId, forceInactivate);
      return ok({
        message:
          "estado" in result && result.estado === "INHABILITADO"
            ? "El servicio fue inhabilitado para proteger reservas activas"
            : "Servicio eliminado exitosamente",
        servicio: result,
      });
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === "NotFoundError") {
        return fail("NOT_FOUND", error.message || "Servicio no encontrado", 404);
      }
      if (error.name === "ServiceHasReservationsError") {
        return fail(
          "ACTIVE_RESERVATIONS",
          error.message || "El servicio tiene reservas activas",
          409,
          { canInactivate: true },
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("Error al eliminar el servicio:", error);
    return fail("SERVER_ERROR", "Error al eliminar el servicio", 500);
  }
}
