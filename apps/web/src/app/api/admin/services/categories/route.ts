import { fail, ok, created } from "@/lib/api-response";
import { createCategoriaSchema } from "@sportcomplex/validation";
import { createCategoria, getCategorias } from "@sportcomplex/db";

/**
 * GET /api/admin/services/categories
 * Retorna el catálogo completo de categorías de servicio (RF-03).
 */
export async function GET() {
  try {
    const categories = await getCategorias();
    return ok(categories);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al consultar categorías";
    return fail("SERVER_ERROR", message, 500);
  }
}

/**
 * POST /api/admin/services/categories
 * Crea una nueva CATEGORIA_SERVICIO.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = createCategoriaSchema.safeParse(rawBody);

    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de categoría inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const categoria = await createCategoria(parsed.data);
      return created(categoria);
    } catch (err: unknown) {
      const error = err as { name?: string; code?: string; message?: string };
      if (error.name === "DuplicateError" || error.code === "P2002") {
        return fail(
          "DUPLICATE_CATEGORY",
          error.message || "Ya existe una categoría con este nombre",
          409,
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear la categoría";
    return fail("SERVER_ERROR", message, 500);
  }
}
