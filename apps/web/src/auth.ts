import NextAuth from "next-auth";
import { prisma } from "@sportcomplex/db";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (account?.provider !== "google" || profile?.email_verified !== true) {
        return false;
      }

      const googleSub = account.providerAccountId;
      const correo = profile.email?.trim().toLowerCase();
      const nombre =
        typeof profile.name === "string" && profile.name.trim()
          ? profile.name.trim()
          : correo?.split("@")[0];
      const avatar =
        typeof profile.picture === "string" ? profile.picture : null;

      if (
        !googleSub ||
        googleSub.length > 100 ||
        !correo ||
        correo.length > 150 ||
        !nombre ||
        nombre.length > 120 ||
        (avatar !== null && avatar.length > 2048)
      ) {
        return false;
      }

      const clienteRole = await prisma.rol.findUnique({
        where: { nombre: "CLIENTE" },
      });
      if (!clienteRole) {
        throw new Error("El rol CLIENTE no está configurado");
      }

      return prisma.$transaction(async (tx: any) => {
        const linkedUser = await tx.usuario.findUnique({
          where: { googleSub },
        });
        const emailMatches = linkedUser
          ? []
          : await tx.usuario.findMany({
              where: { correo: { equals: correo, mode: "insensitive" } },
              take: 2,
            });

        if (emailMatches.length > 1) {
          return false;
        }

        const existingUser = linkedUser ?? emailMatches[0];
        if (existingUser) {
          if (
            existingUser.deletedAt ||
            existingUser.estado === "TEMP_INACTIVO" ||
            existingUser.estado === "INACTIVO" ||
            (existingUser.googleSub && existingUser.googleSub !== googleSub)
          ) {
            return false;
          }

          await tx.usuario.update({
            where: { id: existingUser.id },
            data: {
              googleSub,
              nombre,
              correo,
              avatar,
              estado: "ACTIVO",
            },
          });
          return true;
        }

        await tx.usuario.create({
          data: {
            googleSub,
            nombre,
            correo,
            avatar,
            estado: "ACTIVO",
            rolId: clienteRole.id,
          },
        });
        return true;
      });
    },
    async jwt({ token, account }) {
      if (account?.provider === "google") {
        const user = await prisma.usuario.findUnique({
          where: { googleSub: account.providerAccountId },
          include: { rol: true },
        });
        if (!user || user.estado !== "ACTIVO" || user.deletedAt) {
          throw new Error("No se encontró una cuenta Google activa");
        }

        token.id = user.id;
        token.role = user.rol.nombre;
        token.estado = user.estado;
      }
      return token;
    },
  },
});
