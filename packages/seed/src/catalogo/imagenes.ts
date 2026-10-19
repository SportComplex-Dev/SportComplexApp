import type { SlugServicio } from "./mapa-ids.js";
import { getCatalogoAssetUrl } from "@sportcomplex/domain";

/**
 * Mapa canónico de URLs CDN de imágenes (Supabase Storage).
 * Clave: slug del servicio → Valor: URL absoluta del asset en CDN.
 */
export const mapaImagenesCatalogo: Record<SlugServicio, string> = {
  'tenis-cancha-1': getCatalogoAssetUrl('tenis-cancha-1.webp'),
  'tenis-cancha-2': getCatalogoAssetUrl('tenis-cancha-2.webp'),
  'padel-cancha-1': getCatalogoAssetUrl('padel-cancha-1.webp'),
  'futbol-5-cancha-1': getCatalogoAssetUrl('futbol-5-cancha-1.webp'),
  'futbol-5-cancha-2': getCatalogoAssetUrl('futbol-5-cancha-2.webp'),
  'piscina-nado-libre': getCatalogoAssetUrl('piscina-nado-libre.webp'),
  'piscina-carril-entrenamiento': getCatalogoAssetUrl('piscina-carril-entrenamiento.webp'),
  'piscina-infantil': getCatalogoAssetUrl('piscina-infantil.webp'),
  'gimnasio-sesion-individual': getCatalogoAssetUrl('gimnasio-sesion-individual.webp'),
  'gimnasio-funcional': getCatalogoAssetUrl('gimnasio-funcional.webp'),
  'zona-humeda-sauna': getCatalogoAssetUrl('zona-humeda-sauna.webp'),
  'zona-humeda-turco-jacuzzi': getCatalogoAssetUrl('zona-humeda-turco-jacuzzi.webp'),
};

/**
 * Imagen de respaldo por categoría (subidas a Storage junto al catálogo), para
 * servicios de la BD sin slug canónico.
 */
export const mapaImagenesCategoria: Record<string, string> = {
  canchas: getCatalogoAssetUrl('categoria-canchas.webp'),
  piscinas: getCatalogoAssetUrl('categoria-piscinas.webp'),
  gimnasio: getCatalogoAssetUrl('categoria-gimnasio.webp'),
  'zona-humeda': getCatalogoAssetUrl('categoria-zona-humeda.webp'),
};

// `placeholder.webp` no existe en Storage: el respaldo general es una imagen real.
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
 * URL de imagen de un servicio de la BD: la del mapa canónico si tiene slug;
 * si no (servicio creado fuera de la semilla), la de su categoría. Nunca
 * inventa un `<nombre>.webp` que no existe (issue #115).
 */
export function obtenerRutaImagenServicio(
  slug: SlugServicio | undefined,
  categoriaNombre: string | undefined,
): string {
  if (slug) return obtenerRutaImagen(slug);
  return (categoriaNombre && mapaImagenesCategoria[slugCategoria(categoriaNombre)]) || IMAGEN_POR_DEFECTO;
}
