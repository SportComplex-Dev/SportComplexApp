/**
 * Fuente única autoritativa de correspondencia entre Slugs de servicio e IDs relacionales de BD (§1.6).
 * Resuelve el sistema dual de IDs unificando `resolveCatalogServiceId` y `mapaIdNumericoServicio`.
 */

export interface MetaServicioSeed {
  readonly idBd: number;
  readonly slug: string;
  readonly nombre: string;
}

export const mapaIdServicio = {
  'tenis-cancha-1': { idBd: 17, slug: 'tenis-cancha-1', nombre: 'Cancha de tenis · Cancha 1' },
  'tenis-cancha-2': { idBd: 18, slug: 'tenis-cancha-2', nombre: 'Cancha de tenis · Cancha 2' },
  'padel-cancha-1': { idBd: 19, slug: 'padel-cancha-1', nombre: 'Pádel · Cancha 1' },
  'futbol-5-cancha-1': { idBd: 1, slug: 'futbol-5-cancha-1', nombre: 'Fútbol 5 · Cancha 1' },
  'futbol-5-cancha-2': { idBd: 2, slug: 'futbol-5-cancha-2', nombre: 'Fútbol 5 · Cancha 2' },
  'piscina-nado-libre': { idBd: 4, slug: 'piscina-nado-libre', nombre: 'Piscina · Nado libre' },
  'piscina-carril-entrenamiento': { idBd: 20, slug: 'piscina-carril-entrenamiento', nombre: 'Piscina · Carril entrenamiento' },
  'piscina-infantil': { idBd: 6, slug: 'piscina-infantil', nombre: 'Piscina · Zona infantil' },
  'gimnasio-sesion-individual': { idBd: 5, slug: 'gimnasio-sesion-individual', nombre: 'Gimnasio · Sesión individual' },
  'gimnasio-funcional': { idBd: 7, slug: 'gimnasio-funcional', nombre: 'Gimnasio · Zona funcional' },
  'zona-humeda-sauna': { idBd: 8, slug: 'zona-humeda-sauna', nombre: 'Zona húmeda · Sauna' },
  'zona-humeda-turco-jacuzzi': { idBd: 9, slug: 'zona-humeda-turco-jacuzzi', nombre: 'Zona húmeda · Turco y jacuzzi' },
} as const;

export type SlugServicio = keyof typeof mapaIdServicio;

/**
 * Obtiene el ID numérico de base de datos a partir de un slug canónico.
 * @param {SlugServicio} slug - Slug canónico del servicio
 * @returns {number} ID relacional en PostgreSQL / Supabase
 */
export function obtenerIdBd(slug: SlugServicio): number {
  const item = mapaIdServicio[slug];
  if (!item) {
    throw new Error(`Slug de servicio no reconocido en mapaIdServicio: ${slug}`);
  }
  return item.idBd;
}

/**
 * Obtiene el slug canónico a partir del ID relacional de base de datos.
 * @param {number} idBd - ID relacional del servicio en base de datos
 * @returns {SlugServicio | undefined} Slug canónico o undefined si no existe en el catálogo semilla
 */
export function obtenerSlug(idBd: number): SlugServicio | undefined {
  const entry = Object.entries(mapaIdServicio).find(([, meta]) => meta.idBd === idBd);
  return entry ? (entry[0] as SlugServicio) : undefined;
}

/**
 * Alias de retrocompatibilidad para cart-utils y componentes legados.
 */
export const mapaIdNumericoServicio = obtenerIdBd;
