import { fail, ok, created } from "@/lib/api-response";
import {
  createCategoriaSchema,
  createServicioSchema,
  normalizeServicePayload,
} from "@sportcomplex/validation";
import {
  createCategoria,
  getCategorias,
  createServicio,
  getServicios,
} from "@sportcomplex/db";
import type { EstadoServicio } from "@prisma/client";

/**
 * GET /api/admin/services
 * Lista servicios e instancias con sus calendarios, o categorías del complejo deportivo (RF-03, RF-04).
 * Query params opcionales:
 * - entity=categories | entity=services
 * - categoriaId=<number>
 * - estado=ACTIVO | INHABILITADO
 * - search=<texto>
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get("entity")?.toLowerCase();
    const rawCategoriaId = searchParams.get("categoriaId");
    const categoriaId = rawCategoriaId ? parseInt(rawCategoriaId, 10) : undefined;
    const estado = searchParams.get("estado") as EstadoServicio | undefined;
    const search = searchParams.get("search") || undefined;

    if (entity === "categories" || entity === "categorias") {
      const categories = await getCategorias();
      return ok(categories);
    }

    if (entity === "services" || entity === "servicios") {
      const services = await getServicios({ categoriaId, estado, search });
      return ok(services);
    }

    const [services, categories] = await Promise.all([
      getServicios({ categoriaId, estado, search }),
      getCategorias(),
    ]);

    return ok({ services, categories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al consultar servicios";
    return fail("SERVER_ERROR", message, 500);
  }
}

/**
 * POST /api/admin/services
 * Da de alta:
 * 1. CATEGORIA_SERVICIO (si entity='category' o si faltan datos de servicio pero se define nombre y tipo)
 * 2. Instancia SERVICIO con calendario propio y validación de unicidad por complejo (RF-03, TSK-BE-04).
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    if (typeof rawBody !== "object" || rawBody === null) {
      return fail("INVALID_PAYLOAD", "El cuerpo de la solicitud debe ser un objeto JSON", 400);
    }

    const entity = (rawBody.entity || rawBody.tipoEntidad)?.toString().toUpperCase();
    const isCategory =
      entity === "CATEGORIA" ||
      entity === "CATEGORY" ||
      (rawBody.tipo &&
        !rawBody.categoriaId &&
        !rawBody.categoryId &&
        !rawBody.capacidadMaxima &&
        !rawBody.capacity);

    if (isCategory) {
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
    }

    // Instancia SERVICIO
    const normalized = normalizeServicePayload(rawBody);
    const parsed = createServicioSchema.safeParse(normalized);

    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Datos de servicio inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      const servicio = await createServicio(parsed.data);
      return created(servicio);
    } catch (err: unknown) {
      const error = err as { name?: string; code?: string; message?: string };
      if (error.name === "DuplicateNameError" || error.code === "P2002") {
        return fail(
          "DUPLICATE_INSTANCE_NAME",
          error.message || `Ya existe un servicio con el nombre "${parsed.data.nombre}" en el complejo.`,
          409,
        );
      }
      if (error.name === "NotFoundError") {
        return fail("CATEGORY_NOT_FOUND", error.message || "Categoría no encontrada", 404);
      }
      throw err;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al procesar la solicitud";
    return fail("SERVER_ERROR", message, 500);
  }
}
