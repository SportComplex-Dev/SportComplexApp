import test from "node:test";
import assert from "node:assert/strict";
import {
  mapaImagenesCatalogo,
  mapaImagenesCategoria,
  obtenerRutaImagenServicio,
} from "../dist/index.js";

/**
 * Inventario de `catalogo/` en Supabase Storage: los 23 `.webp` que subió
 * `packages/db/scripts/upload-assets-storage.mts` (HU-29,
 * docs/features/assets-multimedia.md). Si se sube o borra un asset, se
 * actualiza esta lista junto con el mapa canónico.
 */
const ASSETS_CATALOGO = new Set([
  "categoria-canchas.webp", "categoria-gimnasio.webp", "categoria-piscinas.webp", "categoria-zona-humeda.webp",
  "futbol-5-cancha-1.webp", "futbol-5-cancha-2.webp", "futbol-sintetico.webp",
  "gimnasio-funcional.webp", "gimnasio-pro.webp", "gimnasio-sesion-individual.webp",
  "padel-cancha-1.webp", "padel-panoramico.webp",
  "piscina-carril-entrenamiento.webp", "piscina-climatizada.webp", "piscina-infantil.webp", "piscina-nado-libre.webp",
  "sports-bar-lounge.webp",
  "tenis-cancha-1.webp", "tenis-cancha-2.webp", "tenis-roland-garros.webp",
  "zona-humeda-sauna.webp", "zona-humeda-turco-jacuzzi.webp", "zona-wellness.webp",
]);

const archivo = (url: string) => url.slice(url.lastIndexOf("/catalogo/") + "/catalogo/".length);

test("#115: toda imagen del mapa canónico y de respaldo existe en el inventario de Storage", () => {
  const urls = [...Object.values(mapaImagenesCatalogo), ...Object.values(mapaImagenesCategoria)] as string[];
  const faltantes = urls.map(archivo).filter((f) => !ASSETS_CATALOGO.has(f));
  assert.deepEqual(faltantes, [], `Imágenes referenciadas que no existen en Storage: ${faltantes.join(", ")}`);
});

test("#115: un servicio sin slug canónico usa la imagen de su categoría, no '<nombre>.webp'", () => {
  // "Cancha de Tenis Polvo de Ladrillo" (id 3) no está en mapaIdServicio.
  assert.equal(archivo(obtenerRutaImagenServicio(undefined, "Canchas")), "categoria-canchas.webp");
  assert.equal(archivo(obtenerRutaImagenServicio(undefined, "Zona Húmeda")), "categoria-zona-humeda.webp");
  assert.ok(ASSETS_CATALOGO.has(archivo(obtenerRutaImagenServicio(undefined, "Categoría inexistente"))));
  assert.equal(archivo(obtenerRutaImagenServicio("tenis-cancha-1", "Canchas")), "tenis-cancha-1.webp");
});
