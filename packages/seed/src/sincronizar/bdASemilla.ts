import type { ItemSemillaCatalogo } from "../catalogo/datos.js";
import { obtenerSlug, type SlugServicio } from "../catalogo/mapa-ids.js";
import { obtenerRutaImagen } from "../catalogo/imagenes.js";
import type { CategoriaSlug } from "@sportcomplex/domain";

export interface ServicioDbRecord {
  id: number;
  nombre: string;
  tarifa: number | string;
  capacidadMaxima: number;
  modalidad: string;
  tipoPiscina?: string | null;
  categoria?: {
    id: number;
    nombre: string;
    tipo: string;
  };
}

export function traducirDbASemilla(dbServicio: ServicioDbRecord): ItemSemillaCatalogo | null {
  const slug = obtenerSlug(dbServicio.id);
  if (!slug) return null;

  const categorySlug: CategoriaSlug =
    slug.startsWith("cancha") || slug.startsWith("futbol") || slug.startsWith("tenis") || slug.startsWith("padel")
      ? "canchas"
      : slug.startsWith("piscina")
        ? "piscinas"
        : slug.startsWith("gimnasio")
          ? "gimnasio"
          : "zona-humeda";

  return {
    id: slug,
    slug,
    idBd: dbServicio.id,
    name: dbServicio.nombre,
    category: categorySlug,
    description: `Servicio ${dbServicio.nombre}`,
    price: typeof dbServicio.tarifa === "string" ? parseFloat(dbServicio.tarifa) : dbServicio.tarifa,
    capacity: dbServicio.capacidadMaxima,
    durationMinutes: 60,
    requiresMembership: categorySlug === "zona-humeda",
    sede: "Poblado",
    image: obtenerRutaImagen(slug as SlugServicio),
    isShared: dbServicio.modalidad === "AFORO",
  };
}
