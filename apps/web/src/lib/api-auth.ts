import { auth } from "@/auth";
import { fail } from "@/lib/api-response";
import { createSupabaseServerClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { prisma } from "@sportcomplex/db";
import { normalizeRole, type CanonicalRole } from "@/lib/session";
import { headers } from "next/headers";

export interface ApiActor {
  id: string;
  role: CanonicalRole;
}

export type ApiAuthorization =
  | { authorized: true; actor: ApiActor }
  | { authorized: false; response: Response };

interface SessionLike {
  user?: { id?: string | null; email?: string | null } | null;
}

export interface AuthorizationAccount {
  id: string;
  estado: string;
  deletedAt: Date | null;
  rol: { nombre: string } | null;
}

export interface AuthorizationDatabase {
  usuario: {
    findUnique(args: {
      where: { id: string } | { correo: string };
      select: {
        id: true;
        estado: true;
        deletedAt: true;
        rol: { select: { nombre: true } };
      };
    }): Promise<AuthorizationAccount | null>;
  };
}

interface AuthorizationDependencies {
  authenticate?: () => Promise<SessionLike | null>;
  db?: AuthorizationDatabase;
}

export async function authorizeApiRequest(
  allowedRoles: readonly CanonicalRole[],
  dependencies: AuthorizationDependencies = {},
): Promise<ApiAuthorization> {
  try {
    const injectedSession =
      process.env.NODE_ENV === "test"
        ? (globalThis as typeof globalThis & {
            __scAuthSession?: SessionLike | null;
          }).__scAuthSession
        : undefined;
    if (
      process.env.NODE_ENV !== "test" &&
      !dependencies.authenticate &&
      injectedSession === undefined
    ) {
      const requestHeaders = await headers();
      const userId = requestHeaders.get("x-sc-authenticated-user-id");
      const role = normalizeRole(requestHeaders.get("x-sc-authenticated-role"));
      if (userId && role) {
        if (!allowedRoles.includes(role)) {
          return {
            authorized: false,
            response: fail("FORBIDDEN", "No tienes permisos para esta operación.", 403),
          };
        }
        return { authorized: true, actor: { id: userId, role } };
      }
    }

    const authenticate =
      dependencies.authenticate ??
      (injectedSession !== undefined
        ? async () => injectedSession
        : auth);
    let session = await authenticate();
    if (
      !session?.user?.id &&
      process.env.NODE_ENV !== "test" &&
      isSupabaseAuthConfigured()
    ) {
      const requestHeaders = await headers();
      const authorization = requestHeaders.get("authorization");
      const bearerToken =
        authorization?.toLowerCase().startsWith("bearer ")
          ? authorization.slice(7).trim()
          : undefined;
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getUser(bearerToken);
      if (error) {
        if (error.status !== 400 && error.status !== 401 && error.status !== 403) {
          throw error;
        }
      } else if (data.user) {
        session = {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
        };
      }
    }
    const userId = session?.user?.id;

    if (!userId) {
      return {
        authorized: false,
        response: fail("UNAUTHORIZED", "Debes iniciar sesión.", 401),
      };
    }

    const db: AuthorizationDatabase = dependencies.db ?? prisma;
    const account = (await db.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        estado: true,
        deletedAt: true,
        rol: { select: { nombre: true } },
      },
    })) ?? (
      session?.user?.email
        ? await db.usuario.findUnique({
            where: { correo: session.user.email },
            select: {
              id: true,
              estado: true,
              deletedAt: true,
              rol: { select: { nombre: true } },
            },
          })
        : null
    );

    if (
      !account ||
      account.deletedAt ||
      account.estado !== "ACTIVO"
    ) {
      return {
        authorized: false,
        response: fail("FORBIDDEN", "La cuenta no está activa.", 403),
      };
    }

    const role = normalizeRole(account.rol?.nombre);
    if (!role || !allowedRoles.includes(role)) {
      return {
        authorized: false,
        response: fail("FORBIDDEN", "No tienes permisos para esta operación.", 403),
      };
    }

    return { authorized: true, actor: { id: account.id, role } };
  } catch (error: unknown) {
    console.error("Error al comprobar la autorización de API:", error);
    return {
      authorized: false,
      response: fail("AUTHORIZATION_UNAVAILABLE", "No se pudo verificar el acceso.", 503),
    };
  }
}
