import test from "node:test";
import assert from "node:assert/strict";
import { handleResetPassword } from "@/app/api/auth/reset-password/route";

const claims = { userId: "user-1", email: "ana@example.com", credentialVersion: "version-1" };
const initialUser = { id: "user-1", correo: "ana@example.com", estado: "ACTIVO", passwordHash: "hash-old" };
type TestDependencies = {
  verifyToken(token: string): typeof claims | null;
  findUser(userId: string, email: string): Promise<typeof initialUser | null>;
  isTokenCurrent(version: string, passwordHash: string | null): boolean;
  hashPassword(password: string): Promise<string>;
  updateAuthPassword(email: string, password: string): Promise<boolean>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<unknown>;
};

function request(body: unknown) {
  return new Request("http://localhost/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function responseCode(response: Response) {
  return response.json().then((body) => body.error.code as string);
}

function dependencies(overrides: Partial<TestDependencies> = {}): TestDependencies {
  return {
    verifyToken: () => claims,
    findUser: async () => ({ ...initialUser }),
    isTokenCurrent: (version: string, passwordHash: string | null) => version === "version-1" && passwordHash === "hash-old",
    hashPassword: async () => "hash-new",
    updateAuthPassword: async () => true,
    updatePasswordHash: async () => undefined,
    ...overrides,
  };
}

test("POST /api/auth/reset-password devuelve VALIDATION_ERROR para datos inválidos", async () => {
  const response = await handleResetPassword(request({ token: "", password: "corta" }), dependencies());
  assert.equal(response.status, 400);
  assert.equal(await responseCode(response), "VALIDATION_ERROR");
});

test("POST /api/auth/reset-password rechaza tokens adulterados o expirados", async () => {
  const response = await handleResetPassword(
    request({ token: "tampered", password: "NuevaClave123" }),
    dependencies({ verifyToken: () => null }),
  );
  assert.equal(response.status, 400);
  assert.equal(await responseCode(response), "INVALID_RESET_TOKEN");
});

test("POST /api/auth/reset-password invalida el token después de usarlo", async () => {
  let currentHash = "hash-old";
  let updates = 0;
  const deps = dependencies({
    findUser: async () => ({ ...initialUser, passwordHash: currentHash }),
    isTokenCurrent: (version: string, passwordHash: string | null) => version === "version-1" && passwordHash === "hash-old",
    updatePasswordHash: async (_id: string, hash: string) => { currentHash = hash; updates += 1; },
  });

  const first = await handleResetPassword(request({ token: "valid", password: "NuevaClave123" }), deps);
  assert.equal(first.status, 200);
  const reused = await handleResetPassword(request({ token: "valid", password: "OtraClave123" }), deps);
  assert.equal(reused.status, 400);
  assert.equal(await responseCode(reused), "INVALID_RESET_TOKEN");
  assert.equal(updates, 1);
});

test("POST /api/auth/reset-password no permite cambiar claves de cuentas inactivas", async () => {
  for (const estado of ["BLOQUEADO", "INACTIVO", "PENDIENTE"]) {
    let updates = 0;
    const response = await handleResetPassword(
      request({ token: "valid", password: "NuevaClave123" }),
      dependencies({
        findUser: async () => ({ ...initialUser, estado }),
        updateAuthPassword: async () => { updates += 1; return true; },
        updatePasswordHash: async () => { updates += 1; },
      }),
    );
    assert.equal(response.status, 400, estado);
    assert.equal(await responseCode(response), "INVALID_RESET_TOKEN", estado);
    assert.equal(updates, 0, estado);
  }
});

test("POST /api/auth/reset-password mapea fallos de persistencia a RESET_FAILED", async () => {
  const response = await handleResetPassword(
    request({ token: "valid", password: "NuevaClave123" }),
    dependencies({ updatePasswordHash: async () => { throw new Error("database unavailable"); } }),
  );
  assert.equal(response.status, 500);
  assert.equal(await responseCode(response), "RESET_FAILED");

  const authUnavailable = await handleResetPassword(
    request({ token: "valid", password: "NuevaClave123" }),
    dependencies({ updateAuthPassword: async () => false }),
  );
  assert.equal(authUnavailable.status, 500);
  assert.equal(await responseCode(authUnavailable), "RESET_FAILED");
});
