import test from "node:test";
import assert from "node:assert/strict";
import { POST, expiredCookieHeader } from "@/app/api/auth/logout/route";

test("API: POST /api/auth/logout responde 200 y expira cookies de sesión", async () => {
  const res = await POST();

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.message, "Sesión cerrada exitosamente.");

  // Verificar que expira las cookies de sesión propias y las de Auth.js
  const setCookieHeaders = res.headers.getSetCookie();
  for (const name of ["sc-session", "sc-role", "sc-status", "sc-token"]) {
    const header = setCookieHeaders.find((h) => h.startsWith(`${name}=`));
    assert.ok(header?.includes("Max-Age=0"), `${name} debe tener Max-Age=0`);
    assert.ok(header?.includes("HttpOnly"), `${name} debe tener HttpOnly`);
  }
});

test("expiredCookieHeader refleja Secure solo cuando se pide (regla __Secure-*)", () => {
  const insecure = expiredCookieHeader("__Secure-authjs.session-token", false);
  assert.ok(!insecure.includes("; Secure"), "sin secure no debe incluir el flag");

  const secure = expiredCookieHeader("__Secure-authjs.session-token", true);
  assert.ok(secure.includes("; Secure"), "con secure debe incluir el flag");
  assert.ok(secure.includes("Max-Age=0"), "debe seguir expirando la cookie");
});
