import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { extractSupabaseAccessToken } from "../session";

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
