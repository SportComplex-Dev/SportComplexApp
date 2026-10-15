import test from "node:test";
import assert from "node:assert/strict";
import { FestivosBatchSchema } from "../src/negocio/automation.schema.ts";

test("festivos: acepta lote válido", () => {
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "2026-01-01", nombre: "Año Nuevo", anio: 2026 }],
    }).success,
    true,
  );
});

test("festivos: rechaza fecha con formato inválido", () => {
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "01/01/2026", nombre: "X", anio: 2026 }],
    }).success,
    false,
  );
});

test("festivos: rechaza lote vacío y nombre largo", () => {
  assert.equal(FestivosBatchSchema.safeParse({ festivos: [] }).success, false);
  assert.equal(
    FestivosBatchSchema.safeParse({
      festivos: [{ fecha: "2026-01-01", nombre: "x".repeat(101), anio: 2026 }],
    }).success,
    false,
  );
});
