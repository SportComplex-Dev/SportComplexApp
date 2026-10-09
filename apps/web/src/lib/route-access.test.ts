import test from "node:test";
import assert from "node:assert/strict";
import { isRoleAllowedForPath } from "./route-access";

test("perimeter role policy denies readers access to POS and admin", () => {
  assert.equal(isRoleAllowedForPath("/pos", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/pos/caja", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/api/pos/sales", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/admin", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/admin/employees", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/api/admin/employees", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/api/tickets/verify/code", "Empleado_Vendedor"), false);
});

test("perimeter role policy grants only the configured role groups", () => {
  assert.equal(isRoleAllowedForPath("/admin", "Administrador"), true);
  assert.equal(isRoleAllowedForPath("/pos", "Empleado_Vendedor"), true);
  assert.equal(isRoleAllowedForPath("/pos", "Administrador"), true);
  assert.equal(isRoleAllowedForPath("/scanner", "Empleado_Lector"), true);
  assert.equal(isRoleAllowedForPath("/api/tickets/verify/code", "Empleado_Lector"), true);
  assert.equal(isRoleAllowedForPath("/portal", "Cliente"), true);
  assert.equal(isRoleAllowedForPath("/api/pdf/receipt", "Cliente"), true);
  assert.equal(isRoleAllowedForPath("/api/pdf/receipt", "Empleado_Vendedor"), true);
  assert.equal(isRoleAllowedForPath("/api/pdf/receipt", "Empleado_Lector"), false);
  assert.equal(isRoleAllowedForPath("/portal", "Administrador"), false);
  assert.equal(isRoleAllowedForPath("/portal", null), false);
});
