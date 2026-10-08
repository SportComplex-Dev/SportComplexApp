import { fail, ok, created } from "@/lib/api-response";
import { authorizeApiRoles } from "@/lib/api-auth";
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
    const denied = await authorizeApiRoles(["Administrador"]);
    if (denied) return denied;

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
    console.error("Error en GET /api/admin/services:", error);
    return fail("SERVER_ERROR", "Error al consultar servicios", 500);
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
    const denied = await authorizeApiRoles(["Administrador"]);
    if (denied) return denied;

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
        const error = err as {
          name?: string;
          code?: string;
          message?: string;
          meta?: { target?: string[] | string };
        };
        const isDuplicateCategory =
          error.name === "DuplicateError" ||
          (error.code === "P2002" &&
            (Array.isArray(error.meta?.target)
              ? error.meta.target.includes("nombre")
              : typeof error.meta?.target === "string" &&
                (error.meta.target.includes("nombre") ||
                  error.meta.target.includes("categoria_servicio_nombre_key"))));

        if (isDuplicateCategory) {
          return fail(
            "DUPLICATE_CATEGORY",
            `Ya existe una categoría con el nombre "${parsed.data.nombre}".`,
            409,
          );
        }
        console.error("Error al crear categoría:", err);
        return fail("SERVER_ERROR", "Error al procesar la categoría", 500);
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
      const error = err as {
        name?: string;
        code?: string;
        message?: string;
        meta?: { target?: string[] | string };
      };

      // Solo el duplicado REAL de nombre de servicio debe ser 409
      const isDuplicateServiceName =
        error.name === "DuplicateNameError" ||
        (error.code === "P2002" &&
          (Array.isArray(error.meta?.target)
            ? error.meta.target.includes("nombre")
            : typeof error.meta?.target === "string" &&
              (error.meta.target.includes("nombre") ||
                error.meta.target.includes("servicio_nombre_key"))));

      if (isDuplicateServiceName) {
        return fail(
          "DUPLICATE_INSTANCE_NAME",
          `Ya existe un servicio con el nombre "${parsed.data.nombre}" en el complejo.`,
          409,
        );
      }

      if (error.name === "NotFoundError") {
        return fail("CATEGORY_NOT_FOUND", error.message || "Categoría no encontrada", 404);
      }

      console.error("Error de base de datos al crear servicio:", err);
      return fail("SERVER_ERROR", "Error al procesar el servicio", 500);
    }
  } catch (error: unknown) {
    console.error("Error en POST /api/admin/services:", error);
    return fail("SERVER_ERROR", "Error al procesar la solicitud", 500);
  }
}
