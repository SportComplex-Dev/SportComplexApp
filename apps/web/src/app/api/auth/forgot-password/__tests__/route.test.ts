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
    getClientIp: () => "192.0.2.1",
    consumeLimit: () => true,
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

test("rate limits por IP o correo y conserva la respuesta genérica", async () => {
  let lookups = 0;
  let sends = 0;
  const deps = {
    findUserByEmail: async () => { lookups += 1; return user; },
    createToken: () => "signed-token",
    sendEmail: async () => { sends += 1; },
    appUrl: "https://sportcomplex.example",
    getClientIp: () => "192.0.2.8",
  };
  const rateLimited = await handleForgotPassword(request(user.correo), {
    ...deps,
    consumeLimit: (key: string) => !key.startsWith("forgot-password:email:"),
  });
  assert.equal(rateLimited.status, 200);
  assert.equal((await rateLimited.json()).data.message, message);
  assert.equal(lookups, 0);
  assert.equal(sends, 0);

  const ipLimited = await handleForgotPassword(request("bad-email"), {
    ...deps,
    consumeLimit: () => false,
  });
  assert.equal(ipLimited.status, 200);
  assert.equal((await ipLimited.json()).data.message, message);
  assert.equal(lookups, 0);
});

test("advierte si falta NEXT_PUBLIC_APP_URL y no despacha el correo", async () => {
  let sends = 0;
  const warning = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    const response = await handleForgotPassword(request(user.correo), {
      findUserByEmail: async () => user,
      createToken: () => "signed-token",
      sendEmail: async () => { sends += 1; },
      appUrl: undefined,
      getClientIp: () => "192.0.2.9",
      consumeLimit: () => true,
    });
    assert.equal(response.status, 200);
  } finally {
    console.warn = warning;
  }
  assert.equal(sends, 0);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]?.[0]), /NEXT_PUBLIC_APP_URL/);
});
