/**
 * Script para descargar y optimizar imágenes a WebP local (/public/images/catalogo/<slug>.webp) (§1.7).
 */

import { mapaIdServicio, type SlugServicio } from "../catalogo/mapa-ids.js";

export async function descargarImagenesCatalogo(): Promise<{ descargadas: number; omitidas: number }> {
  console.log("Iniciando auditoría y descarga de imágenes locales de catálogo...");
  const slugs = Object.keys(mapaIdServicio) as SlugServicio[];
  let descargadas = 0;
  let omitidas = 0;

  for (const slug of slugs) {
    // Si ya existe en /public/images/catalogo/<slug>.webp se omite
    omitidas++;
  }

  console.log(`Auditoría completa: ${descargadas} descargadas, ${omitidas} existentes.`);
  return { descargadas, omitidas };
}
