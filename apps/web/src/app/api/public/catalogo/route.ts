import { getServicios, getCategorias } from "@sportcomplex/db";
import { ok, fail } from '@sportcomplex/shared/lib';
import { obtenerSlug } from '@sportcomplex/seed';

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

    return ok(
      {
        servicios: servicios.map((s: { id: number } & Record<string, unknown>) => ({
          ...s,
          slug: obtenerSlug(s.id) ?? undefined,
        })),
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
