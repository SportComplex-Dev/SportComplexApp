import { redirect } from "next/navigation";
import { prisma } from "@sportcomplex/db";
import { auth } from "@/auth";
import { fail } from "@/lib/api-response";
import { normalizeRole, type CanonicalRole } from "@/lib/session";

export interface AuthorizedApiUser {
  userId: string;
  role: CanonicalRole;
}

async function getSessionUserId(): Promise<string | undefined> {
  const testUserId =
    process.env.NODE_ENV === "test"
      ? (globalThis as typeof globalThis & { __scApiAuthUserId?: string }).__scApiAuthUserId
      : undefined;
  return testUserId ?? (await auth())?.user?.id;
}

export async function authorizeApiRoles(
  allowedRoles: readonly CanonicalRole[],
): Promise<Response | null> {
  const result = await getAuthorizedApiUser(allowedRoles);
  return result instanceof Response ? result : null;
}

export async function getAuthorizedApiUser(
  allowedRoles: readonly CanonicalRole[],
): Promise<AuthorizedApiUser | Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return fail("UNAUTHORIZED", "Debes iniciar sesión.", 401);
  }

  const account = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      estado: true,
      deletedAt: true,
      rol: { select: { nombre: true } },
    },
  });
  if (!account || account.deletedAt || account.estado !== "ACTIVO") {
    return fail("FORBIDDEN", "La cuenta no está activa.", 403);
  }

  const role = normalizeRole(account.rol.nombre);
  if (!role || !allowedRoles.includes(role)) {
    return fail("FORBIDDEN", "No tienes permisos para esta operación.", 403);
  }
  return { userId, role };
}

export async function requirePageRoles(
  allowedRoles: readonly CanonicalRole[],
): Promise<void> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const account = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      estado: true,
      deletedAt: true,
      rol: { select: { nombre: true } },
    },
  });
  if (!account || account.deletedAt || account.estado !== "ACTIVO") {
    redirect("/access-denied");
  }

  const role = normalizeRole(account.rol.nombre);
  if (!role || !allowedRoles.includes(role)) {
    redirect("/access-denied");
  }
}
