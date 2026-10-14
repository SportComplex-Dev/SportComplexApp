import { ok, fail } from "@/lib/api-response";
import {
  getServicios,
  getCategorias,
  getServicios as obtenerServicios,
  getCategorias as obtenerCategorias,
} from "@sportcomplex/db";

export const revalidate = 60;

export async function GET() {
  try {
    const fetchServicios = obtenerServicios || getServicios;
    const fetchCategorias = obtenerCategorias || getCategorias;

    const [servicios, categorias] = await Promise.all([
      fetchServicios({ estado: "ACTIVO" }),
      fetchCategorias(),
    ]);

    return ok(
      { servicios, categorias },
      { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" }
    );
  } catch (error: unknown) {
    console.error("Error en GET /api/public/catalogo:", error);
    return fail("ERROR_CATALOGO", "No se pudo cargar el catálogo público.", 500);
  }
}
