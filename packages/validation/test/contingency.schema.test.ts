import test from "node:test";
import assert from "node:assert/strict";
import { disableServiceForContingencySchema } from "../src/contingency.schema.ts";

test("TSK-BE-22: valida servicio y motivo de contingencia", () => {
  assert.equal(
    disableServiceForContingencySchema.safeParse({
      serviceId: "4",
      motivo: "Cierre por daño estructural",
    }).success,
    true,
  );
  assert.equal(
    disableServiceForContingencySchema.safeParse({
      serviceId: 0,
      motivo: "No válido",
    }).success,
    false,
  );
  assert.equal(
    disableServiceForContingencySchema.safeParse({
      serviceId: 4,
      motivo: "No",
    }).success,
    false,
  );
});
