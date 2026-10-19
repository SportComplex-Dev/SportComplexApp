import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../../client.js";
import { findPasswordResetUserByEmail, findPasswordResetUser } from "./password-reset.js";

test("password reset busca correos sin distinguir mayúsculas y minúsculas", async () => {
  const findFirstOriginal = prisma.usuario.findFirst;
  const queries: unknown[] = [];
  prisma.usuario.findFirst = (async (args: unknown) => {
    queries.push(args);
    return null;
  }) as typeof prisma.usuario.findFirst;

  try {
    await findPasswordResetUserByEmail("ana@example.com");
    await findPasswordResetUser("user-1", "ana@example.com");
  } finally {
    prisma.usuario.findFirst = findFirstOriginal;
  }

  assert.deepEqual(queries, [
    {
      where: { correo: { equals: "ana@example.com", mode: "insensitive" }, deletedAt: null },
      select: { id: true, correo: true, nombre: true, passwordHash: true },
    },
    {
      where: { id: "user-1", correo: { equals: "ana@example.com", mode: "insensitive" }, deletedAt: null },
      select: { id: true, correo: true, estado: true, passwordHash: true },
    },
  ]);
});
