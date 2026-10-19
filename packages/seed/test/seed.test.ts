import test from "node:test";
import assert from "node:assert/strict";
import {
  mapaIdServicio,
  obtenerIdBd,
  obtenerSlug,
  mapaIdNumericoServicio,
  validarConsistenciaSemilla,
  catalogoSemilla,
} from "../dist/index.js";

test("@sportcomplex/seed: mapaIdServicio contiene los 12 slugs del plan 1.6", () => {
  const slugs = Object.keys(mapaIdServicio);
  assert.equal(slugs.length, 12);
  assert.equal(obtenerIdBd("futbol-5-cancha-1"), 1);
  assert.equal(obtenerIdBd("futbol-5-cancha-2"), 2);
  assert.equal(obtenerIdBd("tenis-cancha-1"), 17);
  assert.equal(obtenerIdBd("tenis-cancha-2"), 18);
  assert.equal(obtenerIdBd("padel-cancha-1"), 19);
  assert.equal(obtenerIdBd("piscina-nado-libre"), 4);
  assert.equal(obtenerIdBd("piscina-carril-entrenamiento"), 20);
  assert.equal(obtenerIdBd("piscina-infantil"), 6);
  assert.equal(obtenerIdBd("gimnasio-sesion-individual"), 5);
  assert.equal(obtenerIdBd("gimnasio-funcional"), 7);
  assert.equal(obtenerIdBd("zona-humeda-sauna"), 8);
  assert.equal(obtenerIdBd("zona-humeda-turco-jacuzzi"), 9);
});

test("@sportcomplex/seed: obtenerSlug resuelve el slug inverso a partir del idBd", () => {
  assert.equal(obtenerSlug(1), "futbol-5-cancha-1");
  assert.equal(obtenerSlug(17), "tenis-cancha-1");
  assert.equal(obtenerSlug(19), "padel-cancha-1");
  assert.equal(obtenerSlug(9999), undefined);
});

test("@sportcomplex/seed: mapaIdNumericoServicio es alias de obtenerIdBd", () => {
  assert.equal(mapaIdNumericoServicio("padel-cancha-1"), 19);
});

test("@sportcomplex/seed: ids de BD unicos y slug desconocido lanza", () => {
  const ids = Object.values(mapaIdServicio).map((m) => m.idBd);
  assert.equal(new Set(ids).size, ids.length);
  assert.throws(() => obtenerIdBd("cancha-inexistente" as never), /no reconocido/);
  assert.equal(obtenerSlug(20), "piscina-carril-entrenamiento");
});

test("@sportcomplex/seed: validarConsistenciaSemilla pasa al 100% sin discrepancias", () => {
  const res = validarConsistenciaSemilla();
  assert.equal(res.valido, true, `Errores encontrados: ${res.errores.join(", ")}`);
  assert.equal(res.errores.length, 0);
  assert.equal(res.totalServicios, 12);
});
