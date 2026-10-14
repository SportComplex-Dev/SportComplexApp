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

export function obtenerRutaImagen(slug: SlugServicio): string {
  return mapaImagenesCatalogo[slug] ?? '/images/catalogo/placeholder.webp';
}
