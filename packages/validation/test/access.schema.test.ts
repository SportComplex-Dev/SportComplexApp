import test from "node:test";
import assert from "node:assert/strict";
import { accessScanSchema } from "../src/access.schema.ts";

const UUID = "9f0d6f4e-0000-4000-8000-0000000000ff";

test("accessScanSchema acepta servicioId numérico y null (modo consulta)", () => {
  const conServicio = accessScanSchema.safeParse({
    ticketId: UUID,
    signature: "a".repeat(64),
    postServiceId: 12,
  });
  assert.equal(conServicio.success, true);
  if (conServicio.success) assert.equal(conServicio.data.postServiceId, 12);

  const consulta = accessScanSchema.safeParse({
    ticketId: UUID,
    signature: "a".repeat(64),
    postServiceId: null,
  });
  assert.equal(consulta.success, true);
  if (consulta.success) assert.equal(consulta.data.postServiceId, null);
});

test("TSK-BD-10 fix: postServiceId ya no acepta un UUID (string) — era servicio.id Int", () => {
  const uuidComoServicio = accessScanSchema.safeParse({
    ticketId: UUID,
    signature: "a".repeat(64),
    postServiceId: "12",
  });
  assert.equal(uuidComoServicio.success, true); // coerción numérica
  if (uuidComoServicio.success) {
    assert.equal(uuidComoServicio.data.postServiceId, 12);
  }

  const basura = accessScanSchema.safeParse({
    ticketId: UUID,
    signature: "a".repeat(64),
    postServiceId: "no-numerico",
  });
  assert.equal(basura.success, false);
});

test("accessScanSchema rechaza ticketId no-UUID y firma corta", () => {
  assert.equal(
    accessScanSchema.safeParse({ ticketId: "no-uuid", signature: "a".repeat(64), postServiceId: null })
      .success,
    false,
  );
  assert.equal(
    accessScanSchema.safeParse({ ticketId: UUID, signature: "corta", postServiceId: null }).success,
    false,
  );
});
