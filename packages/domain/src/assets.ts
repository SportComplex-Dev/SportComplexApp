/**
 * Helper centralizado de URLs de assets CDN (TSK-FE-30b · HU-29).
 * Capa 0: sin dependencias internas.
 *
 * Sin host hardcodeado: la base se deriva de `NEXT_PUBLIC_SUPABASE_URL`
 * (horneada en build) + el bucket público, así cambiar de proyecto Supabase no
 * obliga a tocar código. `NEXT_PUBLIC_ASSETS_BASE_URL` sigue mandando cuando
 * está definida (override explícito, p. ej. un CDN externo).
 */
const ASSETS_BUCKET = "sportcomplex-assets";

function getAssetsBase(): string {
  const explicit = process.env.NEXT_PUBLIC_ASSETS_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/+$/,
    "",
  );
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/${ASSETS_BUCKET}`
    : "";
}

export function getAssetUrl(path: string): string {
  const base = getAssetsBase();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getCatalogoAssetUrl(filename: string): string {
  return getAssetUrl(`/catalogo/${filename}`);
}
