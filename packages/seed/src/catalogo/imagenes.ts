import type { SlugServicio } from "./mapa-ids.js";
import { getCatalogoAssetUrl } from "@sportcomplex/domain";

/**
 * Nombres de archivo físicos canónicos en apps/web/public/images/catalogo/ y Supabase Storage.
 */
export const archivosImagenesCatalogo: Record<SlugServicio, string> = {
  'tenis-cancha-1': 'tenis-cancha-1.webp',
  'tenis-cancha-2': 'tenis-cancha-2.webp',
  'padel-cancha-1': 'padel-cancha-1.webp',
  'futbol-5-cancha-1': 'futbol-5-cancha-1.webp',
  'futbol-5-cancha-2': 'futbol-5-cancha-2.webp',
  'piscina-nado-libre': 'piscina-nado-libre.webp',
  'piscina-carril-entrenamiento': 'piscina-carril-entrenamiento.webp',
  'piscina-infantil': 'piscina-infantil.webp',
  'gimnasio-sesion-individual': 'gimnasio-sesion-individual.webp',
  'gimnasio-funcional': 'gimnasio-funcional.webp',
  'zona-humeda-sauna': 'zona-humeda-sauna.webp',
  'zona-humeda-turco-jacuzzi': 'zona-humeda-turco-jacuzzi.webp',
};

/**
 * Mapa canónico de URLs CDN de imágenes (Supabase Storage).
 * Clave: slug del servicio → Valor: URL absoluta del asset en CDN.
 */
export const mapaImagenesCatalogo: Record<SlugServicio, string> = {
  'tenis-cancha-1': getCatalogoAssetUrl(archivosImagenesCatalogo['tenis-cancha-1']),
  'tenis-cancha-2': getCatalogoAssetUrl(archivosImagenesCatalogo['tenis-cancha-2']),
  'padel-cancha-1': getCatalogoAssetUrl(archivosImagenesCatalogo['padel-cancha-1']),
  'futbol-5-cancha-1': getCatalogoAssetUrl(archivosImagenesCatalogo['futbol-5-cancha-1']),
  'futbol-5-cancha-2': getCatalogoAssetUrl(archivosImagenesCatalogo['futbol-5-cancha-2']),
  'piscina-nado-libre': getCatalogoAssetUrl(archivosImagenesCatalogo['piscina-nado-libre']),
  'piscina-carril-entrenamiento': getCatalogoAssetUrl(archivosImagenesCatalogo['piscina-carril-entrenamiento']),
  'piscina-infantil': getCatalogoAssetUrl(archivosImagenesCatalogo['piscina-infantil']),
  'gimnasio-sesion-individual': getCatalogoAssetUrl(archivosImagenesCatalogo['gimnasio-sesion-individual']),
  'gimnasio-funcional': getCatalogoAssetUrl(archivosImagenesCatalogo['gimnasio-funcional']),
  'zona-humeda-sauna': getCatalogoAssetUrl(archivosImagenesCatalogo['zona-humeda-sauna']),
  'zona-humeda-turco-jacuzzi': getCatalogoAssetUrl(archivosImagenesCatalogo['zona-humeda-turco-jacuzzi']),
};

export function obtenerRutaImagen(slug: SlugServicio | string): string {
  if (slug === 'cancha-de-tenis-polvo-de-ladrillo' || slug === 'tenis-polvo-de-ladrillo') {
    return mapaImagenesCatalogo['tenis-cancha-1'];
  }
  return (mapaImagenesCatalogo as Record<string, string>)[slug] ?? getCatalogoAssetUrl('tenis-cancha-1.webp');
}

export function extraerNombreArchivo(urlORuta: string): string {
  const sinParametros = (urlORuta.split('?')[0] ?? '').split('#')[0] ?? '';
  const partes = sinParametros.split('/');
  return partes[partes.length - 1] ?? '';
}
