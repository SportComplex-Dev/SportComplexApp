import test from "node:test";
import assert from "node:assert/strict";
import { accessRedeemSchema, accessScanSchema } from "../src/platform/access.schema.ts";

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

  assert.equal(
    accessScanSchema.safeParse({
      ticketId: UUID,
      signature: "a".repeat(64),
      postServiceId: true,
    }).success,
    false,
  );
  assert.equal(
    accessScanSchema.safeParse({
      ticketId: UUID,
      signature: "a".repeat(64),
      postServiceId: false,
    }).success,
    false,
  );
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

test("TSK-BE-11: la firma debe ser exactamente 64 hex (HMAC-SHA256)", () => {
  // Longitud correcta pero caracteres no hexadecimales.
  assert.equal(
    accessScanSchema.safeParse({ ticketId: UUID, signature: "z".repeat(64), postServiceId: null })
      .success,
    false,
  );
  // 63 y 65 hex quedan fuera.
  assert.equal(
    accessScanSchema.safeParse({ ticketId: UUID, signature: "a".repeat(63), postServiceId: null })
      .success,
    false,
  );
  assert.equal(
    accessScanSchema.safeParse({ ticketId: UUID, signature: "a".repeat(65), postServiceId: null })
      .success,
    false,
  );
  // Mayúsculas válidas y transformadas a minúsculas (observación de @Its-JrDev).
  const upper = accessScanSchema.safeParse({ ticketId: UUID, signature: "A".repeat(64), postServiceId: null });
  assert.equal(upper.success, true);
  if (upper.success) {
    assert.equal(upper.data.signature, "a".repeat(64));
  }
});

test("TSK-BE-14: accessRedeemSchema valida postServiceId obligatorio positivo y rechaza null o negativo", () => {
  const okNumber = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: 5,
  });
  assert.equal(okNumber.success, true);
  if (okNumber.success) assert.equal(okNumber.data.postServiceId, 5);

  const okStringNumber = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: "7",
  });
  assert.equal(okStringNumber.success, true);
  if (okStringNumber.success) assert.equal(okStringNumber.data.postServiceId, 7);

  const sinServicio = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: null,
  });
  assert.equal(sinServicio.success, false);

  const servicioZero = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: 0,
  });
  assert.equal(servicioZero.success, false);

  const servicioNegativo = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: -1,
  });
  assert.equal(servicioNegativo.success, false);

  // Validación estricta contra coerción indeseada de booleanos (true -> 1, false -> 0)
  const servicioBooleanoTrue = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: true,
  });
  assert.equal(servicioBooleanoTrue.success, false);

  const servicioBooleanoFalse = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
    postServiceId: false,
  });
  assert.equal(servicioBooleanoFalse.success, false);

  // Decimales y strings inválidos
  assert.equal(
    accessRedeemSchema.safeParse({
      ticketId: UUID,
      signature: "b".repeat(64),
      postServiceId: 1.5,
    }).success,
    false,
  );
  assert.equal(
    accessRedeemSchema.safeParse({
      ticketId: UUID,
      signature: "b".repeat(64),
      postServiceId: "1.5",
    }).success,
    false,
  );
  assert.equal(
    accessRedeemSchema.safeParse({
      ticketId: UUID,
      signature: "b".repeat(64),
      postServiceId: "0",
    }).success,
    false,
  );

  const servicioAusente = accessRedeemSchema.safeParse({
    ticketId: UUID,
    signature: "b".repeat(64),
  });
  assert.equal(servicioAusente.success, false);
});


