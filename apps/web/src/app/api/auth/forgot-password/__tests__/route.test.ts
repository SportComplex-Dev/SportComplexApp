import test from "node:test";
import assert from "node:assert/strict";
import { handleForgotPassword } from "@/app/api/auth/forgot-password/route";

const message = "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";
const user = { id: "user-1", correo: "ana@example.com", nombre: "Ana", passwordHash: "argon-hash" };

function request(email: string) {
  return new Request("http://localhost/api/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

test("POST /api/auth/forgot-password siempre responde 200 con mensaje genérico", async () => {
  const dispatches: Array<{ to: string; resetUrl: string }> = [];
  const deps = {
    findUserByEmail: async (email: string) => email === user.correo ? user : null,
    createToken: () => "signed-token",
    sendEmail: async (input: { to: string; resetUrl: string }) => { dispatches.push(input); },
    appUrl: "https://sportcomplex.example/",
  };

  const known = await handleForgotPassword(request("ANA@example.com"), deps);
  const unknown = await handleForgotPassword(request("nadie@example.com"), deps);
  const invalid = await handleForgotPassword(request("no-es-correo"), deps);
  const knownBody = await known.json();
  const unknownBody = await unknown.json();

  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(invalid.status, 200);
  assert.equal(knownBody.data.message, unknownBody.data.message);
  assert.equal(knownBody.data.message, message);
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0]?.to, user.correo);
  assert.equal(dispatches[0]?.resetUrl, "https://sportcomplex.example/reset-password?token=signed-token");
});
