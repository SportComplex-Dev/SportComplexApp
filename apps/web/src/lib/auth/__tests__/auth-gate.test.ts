import test from "node:test";
import assert from "node:assert/strict";
import {
  authGateFor,
  ACCOUNT_INACTIVE_MESSAGE,
  ACCOUNT_PENDING_MESSAGE,
} from "@/lib/auth/auth-gate";

test("PENDIENTE bloquea con ACCOUNT_PENDING (flujo /verify)", () => {
  assert.deepEqual(authGateFor("PENDIENTE", false), {
    gate: "PENDING",
    code: "ACCOUNT_PENDING",
    message: ACCOUNT_PENDING_MESSAGE,
    status: 403,
  });
});

test("estados no-ACTIVO bloquean con ACCOUNT_INACTIVE", () => {
  for (const estado of ["INACTIVO", "TEMP_INACTIVO"]) {
    assert.deepEqual(authGateFor(estado, false), {
      gate: "INACTIVE",
      code: "ACCOUNT_INACTIVE",
      message: ACCOUNT_INACTIVE_MESSAGE,
      status: 403,
    });
  }
});

test("borrado lógico bloquea aunque el estado diga ACTIVO", () => {
  assert.deepEqual(authGateFor("ACTIVO", true), {
    gate: "INACTIVE",
    code: "ACCOUNT_INACTIVE",
    message: ACCOUNT_INACTIVE_MESSAGE,
    status: 403,
  });
});

test("solo ACTIVO sin borrado lógico abre el acceso", () => {
  assert.deepEqual(authGateFor("ACTIVO", false), { gate: "OK" });
});

test("estado ausente/desconocido nunca abre el acceso (RN-10)", () => {
  assert.deepEqual(authGateFor(null, false), {
    gate: "INACTIVE",
    code: "ACCOUNT_INACTIVE",
    message: ACCOUNT_INACTIVE_MESSAGE,
    status: 403,
  });
  assert.deepEqual(authGateFor("CUALQUIER_COSA", false), {
    gate: "INACTIVE",
    code: "ACCOUNT_INACTIVE",
    message: ACCOUNT_INACTIVE_MESSAGE,
    status: 403,
  });
});