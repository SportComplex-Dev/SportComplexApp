import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@sportcomplex/db";
import type { Role } from "@sportcomplex/core";
import { verifySecret } from "@sportcomplex/core/server";
import { loginSchema } from "@sportcomplex/validation";
import { authConfig } from "./auth.config";
import {
  createSupabaseServerClient,
  isSupabaseAuthConfigured,
} from "./lib/supabase/server";
import { normalizeRole } from "./lib/session";

type UsuarioTransaction = Pick<typeof prisma, "usuario">;

const supportedRoles = [
  "Administrador",
  "Empleado_Vendedor",
  "Empleado_Lector",
  "Cliente",
] satisfies readonly Role[];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { type: "email" },
        password: { type: "password" },
      },
      async authorize(credentials) {
        const validation = loginSchema.safeParse(credentials);
        if (!validation.success) return null;

        const { email, password } = validation.data;

        if (isSupabaseAuthConfigured()) {
          const supabase = await createSupabaseServerClient();
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error || !data.user) return null;

          const metadata = data.user.user_metadata;
          const role = supportedRoles.find(
            (supportedRole) => supportedRole === metadata.role,
          ) ?? "Cliente";
          const metadataName = metadata.name ?? metadata.full_name;
          const name =
            typeof metadataName === "string" && metadataName.trim()
              ? metadataName.trim()
              : data.user.email?.split("@")[0] ?? "Usuario";

          return {
            id: data.user.id,
            email: data.user.email ?? email,
            name,
            role,
            estado: "ACTIVO",
          };
        }

        const user = await prisma.usuario.findUnique({
          where: { correo: email.toLowerCase().trim() },
          include: { rol: true },
        });
        const passwordOk =
          !!user?.passwordHash &&
          !user.deletedAt &&
          (await verifySecret(user.passwordHash, password));

        if (!user || !passwordOk || user.estado !== "ACTIVO") return null;

        return {
          id: user.id,
          email: user.correo,
          name: user.nombre,
          role: normalizeRole(user.rol.nombre) ?? "Cliente",
          estado: user.estado,
        };
      },
    }),
  ],
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

      return prisma.$transaction(async (tx: UsuarioTransaction) => {
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
    async jwt({ token, account, user }) {
      if (account?.provider === "credentials" && user) {
        token.id = user.id;
        token.role = user.role;
        token.estado = user.estado;
        return token;
      }

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
