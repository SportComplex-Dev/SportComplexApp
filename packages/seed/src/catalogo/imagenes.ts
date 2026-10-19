import type { SlugServicio } from "./mapa-ids.js";

/**
 * Mapa canónico de rutas de imágenes locales optimizadas (/public/images/catalogo/<slug>.webp)
 * Cumple con §1.7 y la regla de no depender de CDNs externas de imágenes en producción.
 */
export const mapaImagenesCatalogo: Record<SlugServicio, string> = {
  'tenis-cancha-1': '/images/catalogo/tenis-cancha-1.webp',
  'tenis-cancha-2': '/images/catalogo/tenis-cancha-2.webp',
  'padel-cancha-1': '/images/catalogo/padel-cancha-1.webp',
  'futbol-5-cancha-1': '/images/catalogo/futbol-5-cancha-1.webp',
  'futbol-5-cancha-2': '/images/catalogo/futbol-5-cancha-2.webp',
  'piscina-nado-libre': '/images/catalogo/piscina-nado-libre.webp',
  'piscina-carril-entrenamiento': '/images/catalogo/piscina-carril-entrenamiento.webp',
  'piscina-infantil': '/images/catalogo/piscina-infantil.webp',
  'gimnasio-sesion-individual': '/images/catalogo/gimnasio-sesion-individual.webp',
  'gimnasio-funcional': '/images/catalogo/gimnasio-funcional.webp',
  'zona-humeda-sauna': '/images/catalogo/zona-humeda-sauna.webp',
  'zona-humeda-turco-jacuzzi': '/images/catalogo/zona-humeda-turco-jacuzzi.webp',
};

/** Imagen de respaldo por categoría, para servicios de la BD sin slug canónico. */
export const mapaImagenesCategoria: Record<string, string> = {
  canchas: '/images/catalogo/categoria-canchas.webp',
  piscinas: '/images/catalogo/categoria-piscinas.webp',
  gimnasio: '/images/catalogo/categoria-gimnasio.webp',
  'zona-humeda': '/images/catalogo/categoria-zona-humeda.webp',
};

const IMAGEN_POR_DEFECTO = mapaImagenesCategoria.canchas!;

/** Nombre de categoría de la BD → clave (`Zona Húmeda` → `zona-humeda`). */
export function slugCategoria(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function obtenerRutaImagen(slug: SlugServicio): string {
  return mapaImagenesCatalogo[slug] ?? IMAGEN_POR_DEFECTO;
}

/**
 * Ruta de imagen de un servicio de la BD: la del mapa canónico si tiene slug;
 * si no (servicio creado fuera de la semilla), la de su categoría. Nunca
 * inventa un `<nombre>.webp` que no existe.
 */
export function obtenerRutaImagenServicio(
  slug: SlugServicio | undefined,
  categoriaNombre: string | undefined,
): string {
  if (slug) return obtenerRutaImagen(slug);
  return (categoriaNombre && mapaImagenesCategoria[slugCategoria(categoriaNombre)]) || IMAGEN_POR_DEFECTO;
}
