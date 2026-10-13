import test from "node:test";
import assert from "node:assert/strict";
import { resolveCatalogServiceId } from "../catalog.js";

test("resolveCatalogServiceId: resuelve números directos", () => {
  assert.equal(resolveCatalogServiceId(17), 17);
  assert.equal(resolveCatalogServiceId(4), 4);
});

test("resolveCatalogServiceId: mapea tenis y canchas a IDs reales de Supabase", () => {
  assert.equal(resolveCatalogServiceId("tenis-cancha-1"), 17);
  assert.equal(resolveCatalogServiceId("tenis-cancha-2"), 18);
  assert.equal(resolveCatalogServiceId("padel-cancha-1"), 19);
  assert.equal(resolveCatalogServiceId("futbol-5-cancha-1"), 1);
  assert.equal(resolveCatalogServiceId("futbol-5-cancha-2"), 1);
});

test("resolveCatalogServiceId: mapea piscinas, gimnasio y zona húmeda a IDs reales de Supabase", () => {
  assert.equal(resolveCatalogServiceId("piscina-carril-entrenamiento"), 20);
  assert.equal(resolveCatalogServiceId("piscina-nado-libre"), 4);
  assert.equal(resolveCatalogServiceId("gimnasio-sesion-individual"), 5);
  assert.equal(resolveCatalogServiceId("gimnasio-funcional"), 5);
  assert.equal(resolveCatalogServiceId("zona-humeda-sauna"), 6);
  assert.equal(resolveCatalogServiceId("zona-humeda-turco-jacuzzi"), 6);
});

test("resolveCatalogServiceId: tolera objetos de catálogo con name o id", () => {
  assert.equal(resolveCatalogServiceId({ id: "tenis-cancha-1", name: "Cancha de tenis · Cancha 1" }), 17);
  assert.equal(resolveCatalogServiceId({ id: "custom", name: "Gimnasio · Zona funcional" }), 5);
});
