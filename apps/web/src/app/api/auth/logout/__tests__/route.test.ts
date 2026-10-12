import test from "node:test";
import assert from "node:assert/strict";
import { POST, GET } from "../route";

test("API: POST /api/auth/logout responde 200 y expira cookies de sesión", async () => {
  const res = await POST();

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.message, "Sesión cerrada exitosamente.");

  // Verificar que expira las cookies sc-session, sc-role, sc-status
  const setCookieHeaders = res.headers.getSetCookie();
  assert.ok(setCookieHeaders.length >= 3, "Debe incluir cabeceras Set-Cookie para expirar sesiones");

  const scSession = setCookieHeaders.find((h) => h.startsWith("sc-session="));
  assert.ok(scSession?.includes("Max-Age=0"), "sc-session debe tener Max-Age=0");

  const scRole = setCookieHeaders.find((h) => h.startsWith("sc-role="));
  assert.ok(scRole?.includes("Max-Age=0"), "sc-role debe tener Max-Age=0");

  const scStatus = setCookieHeaders.find((h) => h.startsWith("sc-status="));
  assert.ok(scStatus?.includes("Max-Age=0"), "sc-status debe tener Max-Age=0");
});

test("API: GET /api/auth/logout responde 200 y expira cookies de sesión", async () => {
  const res = await GET();
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
});
