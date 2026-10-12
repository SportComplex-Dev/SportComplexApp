import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeApiRequest,
  type AuthorizationAccount,
  type AuthorizationDatabase,
} from "./api-auth";

function dbFor(account: AuthorizationAccount | null): AuthorizationDatabase {
  return {
    usuario: {
      async findUnique(_args) {
        return account;
      },
    },
  };
}

const session = async (id = "user-1") => ({ user: { id } });

test("API authorization: permits only allowed active database roles", async () => {
  const allowed = await authorizeApiRequest(["Administrador"], {
    authenticate: session,
    db: dbFor({
      id: "user-1",
      estado: "ACTIVO",
      deletedAt: null,
      rol: { nombre: "ADMIN" },
    }),
  });
  assert.equal(allowed.authorized, true);
  if (allowed.authorized) {
    assert.equal(allowed.actor.role, "Administrador");
  }

  const forbidden = await authorizeApiRequest(["Administrador"], {
    authenticate: session,
    db: dbFor({
      id: "user-1",
      estado: "ACTIVO",
      deletedAt: null,
      rol: { nombre: "LECTOR" },
    }),
  });
  assert.equal(forbidden.authorized, false);
  if (!forbidden.authorized) assert.equal(forbidden.response.status, 403);
});

test("API authorization: rejects inactive accounts and missing sessions", async () => {
  const inactive = await authorizeApiRequest(["Empleado_Lector"], {
    authenticate: session,
    db: dbFor({
      id: "user-1",
      estado: "INACTIVO",
      deletedAt: new Date(),
      rol: { nombre: "LECTOR" },
    }),
  });
  assert.equal(inactive.authorized, false);
  if (!inactive.authorized) assert.equal(inactive.response.status, 403);

  const anonymous = await authorizeApiRequest(["Administrador"], {
    authenticate: async () => null,
    db: dbFor(null),
  });
  assert.equal(anonymous.authorized, false);
  if (!anonymous.authorized) assert.equal(anonymous.response.status, 401);
});
