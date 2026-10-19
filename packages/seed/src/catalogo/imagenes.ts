import type { SlugServicio } from "./mapa-ids.js";
import { getCatalogoAssetUrl } from "@sportcomplex/core";

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

export function obtenerRutaImagen(slug: SlugServicio): string {
  return mapaImagenesCatalogo[slug] ?? getCatalogoAssetUrl('placeholder.webp');
}
