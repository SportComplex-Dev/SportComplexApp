import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  extractSupabaseAccessToken,
  escapeIlikePattern,
  normalizeRole,
  normalizeEmbeddedRole,
  isAccountActive,
  verifyScSessionToken,
} from "@/lib/session";

test("extracts Supabase access tokens from JSON cookies", () => {
  const request = new NextRequest("http://localhost/");
  request.cookies.set(
    "sb-project-auth-token",
    JSON.stringify({ access_token: "verified-access-token" }),
  );

  assert.equal(extractSupabaseAccessToken(request), "verified-access-token");
});

test("reassembles chunked base64 Supabase cookies before extracting the token", () => {
  const encoded = `base64-${btoa(JSON.stringify(["verified-access-token", "refresh-token"]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}`;
  const splitAt = Math.floor(encoded.length / 2);
  const request = new NextRequest("http://localhost/");
  request.cookies.set("sb-project-auth-token.1", encoded.slice(splitAt));
  request.cookies.set("sb-project-auth-token.0", encoded.slice(0, splitAt));

  assert.equal(extractSupabaseAccessToken(request), "verified-access-token");
});

// Regresión de la causa raíz del bug "el login da 200 pero se queda en /login":
// la relación embebida usuario→rol llega como objeto (many-to-one), no como array.
test("normalizeEmbeddedRole acepta el rol como OBJETO (PostgREST many-to-one)", () => {
  assert.deepEqual(normalizeEmbeddedRole({ nombre: "ADMIN" }), { nombre: "ADMIN" });
});

test("normalizeEmbeddedRole acepta el rol como ARRAY (variante PostgREST)", () => {
  assert.deepEqual(normalizeEmbeddedRole([{ nombre: "ADMIN" }]), { nombre: "ADMIN" });
});

test("normalizeEmbeddedRole tolera null/undefined/nombre ausente", () => {
  assert.equal(normalizeEmbeddedRole(null), null);
  assert.equal(normalizeEmbeddedRole(undefined), null);
  assert.equal(normalizeEmbeddedRole([]), null);
  assert.equal(normalizeEmbeddedRole({}), null);
});

test("normalizeRole mapea los nombres relacionales y de dominio a la forma canónica", () => {
  assert.equal(normalizeRole("ADMIN"), "Administrador");
  assert.equal(normalizeRole("VENDEDOR"), "Empleado_Vendedor");
  assert.equal(normalizeRole("LECTOR"), "Empleado_Lector");
  assert.equal(normalizeRole("CLIENTE"), "Cliente");
  assert.equal(normalizeRole("empleado_vendedor"), "Empleado_Vendedor");
  assert.equal(normalizeRole("desconocido"), null);
  assert.equal(normalizeRole(null), null);
});

test("isAccountActive solo bloquea estados inactivos explícitos", () => {
  assert.equal(isAccountActive("ACTIVO"), true);
  assert.equal(isAccountActive("INACTIVO"), false);
  assert.equal(isAccountActive("TEMP_INACTIVO"), false);
});

test("isAccountActive es fail-closed ante estado ausente/vacío (RN-10)", () => {
  assert.equal(isAccountActive(undefined), false);
  assert.equal(isAccountActive(null), false);
  assert.equal(isAccountActive(""), false);
  assert.equal(isAccountActive("   "), false);
});

test("escapeIlikePattern neutraliza %, _ y \\ para coincidencia literal", () => {
  assert.equal(escapeIlikePattern("ana_lopez@x.com"), "ana\\_lopez@x.com");
  assert.equal(escapeIlikePattern("100%@x.com"), "100\\%@x.com");
  assert.equal(escapeIlikePattern("a\\b@x.com"), "a\\\\b@x.com");
  assert.equal(escapeIlikePattern("normal@x.com"), "normal@x.com");
});

// Bloqueante de code review: un sc-token malformado NO debe lanzar (tumbaba el middleware con 500).
test("verifyScSessionToken con token malformado devuelve null y no lanza", async () => {
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-secret";
  for (const malformed of ["aaaa.@@@@", "sin-punto", ".", "a.", "....", "abc.def"]) {
    await assert.doesNotReject(async () => {
      assert.equal(await verifyScSessionToken(malformed), null);
    });
  }
});
