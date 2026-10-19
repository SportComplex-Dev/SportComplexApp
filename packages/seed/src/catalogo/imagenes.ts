import type { SlugServicio } from "./mapa-ids.js";

const ASSETS_BASE = process.env.NEXT_PUBLIC_ASSETS_BASE_URL || "";

/**
 * Mapa canónico de URLs CDN de imágenes (Supabase Storage).
 * Clave: slug del servicio → Valor: URL absoluta del asset en CDN.
 */
export const mapaImagenesCatalogo: Record<SlugServicio, string> = {
  'tenis-cancha-1': `${ASSETS_BASE}/catalogo/tenis-cancha-1.webp`,
  'tenis-cancha-2': `${ASSETS_BASE}/catalogo/tenis-cancha-2.webp`,
  'padel-cancha-1': `${ASSETS_BASE}/catalogo/padel-cancha-1.webp`,
  'futbol-5-cancha-1': `${ASSETS_BASE}/catalogo/futbol-5-cancha-1.webp`,
  'futbol-5-cancha-2': `${ASSETS_BASE}/catalogo/futbol-5-cancha-2.webp`,
  'piscina-nado-libre': `${ASSETS_BASE}/catalogo/piscina-nado-libre.webp`,
  'piscina-carril-entrenamiento': `${ASSETS_BASE}/catalogo/piscina-carril-entrenamiento.webp`,
  'piscina-infantil': `${ASSETS_BASE}/catalogo/piscina-infantil.webp`,
  'gimnasio-sesion-individual': `${ASSETS_BASE}/catalogo/gimnasio-sesion-individual.webp`,
  'gimnasio-funcional': `${ASSETS_BASE}/catalogo/gimnasio-funcional.webp`,
  'zona-humeda-sauna': `${ASSETS_BASE}/catalogo/zona-humeda-sauna.webp`,
  'zona-humeda-turco-jacuzzi': `${ASSETS_BASE}/catalogo/zona-humeda-turco-jacuzzi.webp`,
};

export function obtenerRutaImagen(slug: SlugServicio): string {
  return mapaImagenesCatalogo[slug] ?? `${ASSETS_BASE}/catalogo/placeholder.webp`;
}
