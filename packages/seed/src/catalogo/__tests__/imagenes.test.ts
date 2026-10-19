import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  mapaImagenesCatalogo,
  archivosImagenesCatalogo,
  obtenerRutaImagen,
  extraerNombreArchivo,
} from "../imagenes.js";

function findMonorepoRoot(startDir: string): string {
  let cur = startDir;
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, "pnpm-workspace.yaml"))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return startDir;
}

const ROOT_DIR = findMonorepoRoot(process.cwd());
const CATALOGO_DIR = path.resolve(ROOT_DIR, "apps/web/public/images/catalogo");

test("Integridad de imágenes: el directorio físico apps/web/public/images/catalogo existe", () => {
  assert.ok(
    fs.existsSync(CATALOGO_DIR),
    `El directorio físico de imágenes no existe en ${CATALOGO_DIR}`
  );
});

test("Integridad de imágenes: todos los archivos en archivosImagenesCatalogo existen físicamente", () => {
  const entradas = Object.entries(archivosImagenesCatalogo);
  assert.equal(entradas.length, 12, "Deben existir 12 servicios mapeados");

  for (const [slug, archivo] of entradas) {
    const filePath = path.resolve(CATALOGO_DIR, archivo);
    assert.ok(
      fs.existsSync(filePath),
      `La imagen física para el servicio '${slug}' (${archivo}) no existe en ${filePath}`
    );
  }
});

test("Integridad de imágenes: cada URL en mapaImagenesCatalogo apunta a un asset WebP existente", () => {
  for (const [slug, url] of Object.entries(mapaImagenesCatalogo)) {
    assert.ok(url.includes(".webp"), `La URL para '${slug}' debe ser un WebP: ${url}`);
    const archivo = extraerNombreArchivo(url);
    assert.ok(archivo, `No se pudo extraer el nombre de archivo para '${slug}': ${url}`);
    const filePath = path.resolve(CATALOGO_DIR, archivo);
    assert.ok(
      fs.existsSync(filePath),
      `El asset extraído de la URL '${archivo}' para el slug '${slug}' no existe físicamente en ${filePath}`
    );
  }
});

test("Integridad de imágenes: alias cancha-de-tenis-polvo-de-ladrillo resuelve a imagen canónica", () => {
  const ruta = obtenerRutaImagen("cancha-de-tenis-polvo-de-ladrillo");
  assert.equal(
    ruta,
    mapaImagenesCatalogo["tenis-cancha-1"],
    "cancha-de-tenis-polvo-de-ladrillo debe resolver a tenis-cancha-1"
  );

  const archivoTenis = extraerNombreArchivo(ruta);
  assert.equal(archivoTenis, "tenis-cancha-1.webp");
  assert.ok(
    fs.existsSync(path.resolve(CATALOGO_DIR, archivoTenis)),
    "El archivo físico de tenis-cancha-1.webp debe existir"
  );
});

