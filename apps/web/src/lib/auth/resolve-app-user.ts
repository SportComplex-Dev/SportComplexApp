import { prisma } from "@sportcomplex/db";
import { normalizeRole, type CanonicalRole } from "@/lib/auth/session";

export interface ResolvedAppUser {
  id: string;
  email: string;
  name: string;
  role: CanonicalRole | null;
  status: string;
  deleted: boolean;
}

/**
 * Resuelve la cuenta de la tabla `usuario` para una identidad autenticada en
 * Supabase Auth. Enlace por correo normalizado (D2=papelera; se migrará a
 * `usuario.supabase_uid` cuando DB lo coordine), case-insensitive por
 * convención: Auth guarda los correos en minúsculas y la tabla ya está
 * alineada (auditoría supabase-auth-audit.sql).
 */
export async function resolveAppUserByEmail(
  email: string,
): Promise<ResolvedAppUser | null> {
  const usuario = await prisma.usuario.findFirst({
    where: { correo: { equals: email.trim(), mode: "insensitive" } },
    include: { rol: true },
  });

  if (!usuario) return null;

  return {
    id: usuario.id,
    email: usuario.correo,
    name: usuario.nombre,
    role: normalizeRole(usuario.rol?.nombre),
    status: usuario.estado,
    deleted: Boolean(usuario.deletedAt),
  };
}