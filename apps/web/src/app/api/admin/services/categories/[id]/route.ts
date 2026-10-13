import { fail, ok } from "@/lib/api-response";
import { authorizeApiRequest } from "@/lib/api-auth";
import { updateCategoriaSchema } from "@sportcomplex/validation";
import {
  getCategoriaById,
  updateCategoria,
  deleteCategoria,
} from "@sportcomplex/db";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "ID de categoría inválido", 400);
    }

    const category = await getCategoriaById(numId);
    if (!category) {
      return fail("NOT_FOUND", "Categoría no encontrada", 404);
    }

    return ok(category);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener la categoría";
    return fail("SERVER_ERROR", message, 500);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "ID de categoría inválido", 400);
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = updateCategoriaSchema.safeParse(rawBody);

    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de actualización inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const updated = await updateCategoria(numId, parsed.data);
      return ok(updated);
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === "NotFoundError") {
        return fail("NOT_FOUND", error.message || "Categoría no encontrada", 404);
      }
      if (error.name === "DuplicateError") {
        return fail("DUPLICATE_CATEGORY", error.message || "Ya existe una categoría con ese nombre", 409);
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al actualizar la categoría";
    return fail("SERVER_ERROR", message, 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"]);
    if (!authorization.authorized) return authorization.response;

    const { id } = await context.params;
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) {
      return fail("INVALID_ID", "ID de categoría inválido", 400);
    }

    try {
      const deleted = await deleteCategoria(numId);
      return ok({ message: "Categoría eliminada exitosamente", category: deleted });
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      if (error.name === "NotFoundError") {
        return fail("NOT_FOUND", error.message || "Categoría no encontrada", 404);
      }
      if (error.name === "ForeignKeyConflictError") {
        return fail("CATEGORY_HAS_SERVICES", error.message || "La categoría tiene servicios asociados", 409);
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al eliminar la categoría";
    return fail("SERVER_ERROR", message, 500);
  }
}
