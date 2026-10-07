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
    console.error("Error en GET /api/admin/services/categories:", error);
    return fail("SERVER_ERROR", "Error al consultar categorías", 500);
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
      const error = err as {
        name?: string;
        code?: string;
        message?: string;
        meta?: { target?: string[] | string };
      };
      const isDuplicate =
        error.name === "DuplicateError" ||
        (error.code === "P2002" &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes("nombre")
            : typeof error.meta?.target === "string" &&
              (error.meta.target.includes("nombre") ||
                error.meta.target.includes("categoria_servicio_nombre_key"))));

      if (isDuplicate) {
        return fail(
          "DUPLICATE_CATEGORY",
          `Ya existe una categoría con el nombre "${parsed.data.nombre}".`,
          409,
        );
      }
      console.error("Error al crear categoría:", err);
      return fail("SERVER_ERROR", "Error al crear la categoría", 500);
    }
  } catch (error: unknown) {
    console.error("Error en POST /api/admin/services/categories:", error);
    return fail("SERVER_ERROR", "Error al crear la categoría", 500);
  }
}
