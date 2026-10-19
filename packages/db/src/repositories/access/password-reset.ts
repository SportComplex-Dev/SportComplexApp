import { prisma } from "../../client.js";

export async function findPasswordResetUserByEmail(email: string) {
  return prisma.usuario.findFirst({
    where: { correo: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, correo: true, nombre: true, passwordHash: true },
  });
}

export async function findPasswordResetUser(userId: string, email: string) {
  return prisma.usuario.findFirst({
    where: { id: userId, correo: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, correo: true, estado: true, passwordHash: true },
  });
}

export async function updatePasswordHash(userId: string, passwordHash: string) {
  return prisma.usuario.update({ where: { id: userId }, data: { passwordHash } });
}
