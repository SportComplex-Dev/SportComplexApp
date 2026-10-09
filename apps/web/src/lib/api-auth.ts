import { auth } from "@/auth";
import { fail } from "@/lib/api-response";
import { prisma } from "@sportcomplex/db";
import { normalizeRole, type CanonicalRole } from "@/lib/session";

export interface ApiActor {
  id: string;
  role: CanonicalRole;
}

export type ApiAuthorization =
  | { authorized: true; actor: ApiActor }
  | { authorized: false; response: Response };

interface SessionLike {
  user?: { id?: string | null } | null;
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
      where: { id: string };
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
    const authenticate =
      dependencies.authenticate ??
      (injectedSession !== undefined
        ? async () => injectedSession
        : auth);
    const session = await authenticate();
    const userId = session?.user?.id;

    if (!userId) {
      return {
        authorized: false,
        response: fail("UNAUTHORIZED", "Debes iniciar sesión.", 401),
      };
    }

    const db: AuthorizationDatabase = dependencies.db ?? prisma;
    const account = await db.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        estado: true,
        deletedAt: true,
        rol: { select: { nombre: true } },
      },
    });

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
