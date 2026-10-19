import test from "node:test";
import assert from "node:assert/strict";
import { getAssetUrl, getCatalogoAssetUrl } from "../dist/index.js";

const RUTA_BUCKET = "/storage/v1/object/public/sportcomplex-assets";

/** Aísla variables de entorno por test (el helper las lee en cada llamada). */
function conEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const previos = new Map<string, string | undefined>();
  for (const [clave, valor] of Object.entries(vars)) {
    previos.set(clave, process.env[clave]);
    if (valor === undefined) delete process.env[clave];
    else process.env[clave] = valor;
  }
  try {
    return fn();
  } finally {
    for (const [clave, valor] of previos) {
      if (valor === undefined) delete process.env[clave];
      else process.env[clave] = valor;
    }
  }
}

test("getAssetUrl deriva la base de NEXT_PUBLIC_SUPABASE_URL, sin ref hardcodeada", () => {
  const url = conEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://proyecto-de-prueba.supabase.co",
      NEXT_PUBLIC_ASSETS_BASE_URL: undefined,
    },
    () => getAssetUrl("/catalogo/canchas.webp"),
  );

  assert.equal(
    url,
    `https://proyecto-de-prueba.supabase.co${RUTA_BUCKET}/catalogo/canchas.webp`,
  );
  assert.ok(
    !url.includes("phyesjwtzrmrcvmtajay"),
    "no debe quedar ningún ref de proyecto en el código",
  );
});

test("getAssetUrl respeta NEXT_PUBLIC_ASSETS_BASE_URL como override", () => {
  const url = conEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://proyecto-de-prueba.supabase.co",
      NEXT_PUBLIC_ASSETS_BASE_URL: "https://cdn.akros.lat/assets/",
    },
    () => getAssetUrl("catalogo/canchas.webp"),
  );

  assert.equal(url, "https://cdn.akros.lat/assets/catalogo/canchas.webp");
});

test("getCatalogoAssetUrl normaliza el path del catálogo", () => {
  const url = conEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://proyecto-de-prueba.supabase.co/",
      NEXT_PUBLIC_ASSETS_BASE_URL: undefined,
    },
    () => getCatalogoAssetUrl("canchas.webp"),
  );

  assert.equal(
    url,
    `https://proyecto-de-prueba.supabase.co${RUTA_BUCKET}/catalogo/canchas.webp`,
  );
});

test("sin variables de entorno devuelve ruta relativa (sin host)", () => {
  const url = conEnv(
    {
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      NEXT_PUBLIC_ASSETS_BASE_URL: undefined,
    },
    () => getAssetUrl("/catalogo/canchas.webp"),
  );

  assert.equal(url, "/catalogo/canchas.webp");
});
