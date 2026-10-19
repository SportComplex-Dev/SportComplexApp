/**
 * Helper centralizado de URLs de assets CDN (TSK-FE-30b · HU-29).
 * Proporciona fallback seguro a la URL pública de Supabase Storage
 * cuando NEXT_PUBLIC_ASSETS_BASE_URL no está definida.
 */
const DEFAULT_ASSETS_CDN =
  "https://phyesjwtzrmrcvmtajay.supabase.co/storage/v1/object/public/sportcomplex-assets";

function getAssetsBase(): string {
  return process.env.NEXT_PUBLIC_ASSETS_BASE_URL || DEFAULT_ASSETS_CDN;
}

export function getAssetUrl(path: string): string {
  const base = getAssetsBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getCatalogoAssetUrl(filename: string): string {
  return getAssetUrl(`/catalogo/${filename}`);
}