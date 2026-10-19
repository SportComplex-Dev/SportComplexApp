import { getServicios, getCategorias } from "@sportcomplex/db";
import { ok, fail } from '@sportcomplex/shared/lib';
import { obtenerRutaImagenServicio, obtenerSlug } from '@sportcomplex/seed';

export const revalidate = 60;

/**
 * GET /api/public/catalogo
 * Retorna servicios activos y categorías del complejo deportivo con cache ISR de 60s.
 */
export async function GET() {
  try {
    const [servicios, categorias] = await Promise.all([
      getServicios({ estado: "ACTIVO" }),
      getCategorias(),
    ]);

    const nombreCategoria = new Map(
      categorias.map((c: { id: number; nombre: string }) => [c.id, c.nombre]),
    );
    return ok(
      {
        servicios: servicios.map((s: { id: number; categoriaId: number } & Record<string, unknown>) => {
          const slug = obtenerSlug(s.id);
          return {
            ...s,
            slug: slug ?? undefined,
            // Ruta real del mapa canónico (o la de su categoría): el cliente
            // ya no arma `<nombre>.webp`, que daba 404 (issue #115).
            imagen: obtenerRutaImagenServicio(slug, nombreCategoria.get(s.categoriaId)),
          };
        }),
        categorias,
      },
      {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      }
    );
  } catch (error: unknown) {
    console.error("Error al obtener catálogo público:", error);
    return fail("SERVER_ERROR", "Error al consultar el catálogo público.", 500);
  }
}
