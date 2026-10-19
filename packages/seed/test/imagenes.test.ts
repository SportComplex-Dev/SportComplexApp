import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  mapaImagenesCatalogo,
  mapaImagenesCategoria,
  obtenerRutaImagenServicio,
} from "../dist/index.js";

const PUBLIC_DIR = fileURLToPath(new URL("../../../apps/web/public", import.meta.url));
const existe = (ruta: string) => existsSync(`${PUBLIC_DIR}${ruta}`);

test("#115: toda ruta del mapa canónico de imágenes existe en apps/web/public", () => {
  const rutas = [...Object.values(mapaImagenesCatalogo), ...Object.values(mapaImagenesCategoria)];
  const faltantes = rutas.filter((ruta) => !existe(ruta));
  assert.deepEqual(faltantes, [], `Imágenes referenciadas que no existen: ${faltantes.join(", ")}`);
});

test("#115: un servicio sin slug canónico usa la imagen de su categoría, no '<nombre>.webp'", () => {
  // "Cancha de Tenis Polvo de Ladrillo" (id 3) no está en mapaIdServicio.
  const ruta = obtenerRutaImagenServicio(undefined, "Canchas");
  assert.equal(ruta, "/images/catalogo/categoria-canchas.webp");
  assert.ok(existe(ruta));
  assert.equal(obtenerRutaImagenServicio(undefined, "Zona Húmeda"), "/images/catalogo/categoria-zona-humeda.webp");
  assert.ok(existe(obtenerRutaImagenServicio(undefined, "Categoría inexistente")));
  assert.equal(obtenerRutaImagenServicio("tenis-cancha-1", "Canchas"), "/images/catalogo/tenis-cancha-1.webp");
});
