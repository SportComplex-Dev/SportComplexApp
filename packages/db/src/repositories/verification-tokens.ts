import { prisma } from "../client";
import type { TokenVerificacion } from "@prisma/client";

/**
 * Crea un nuevo token de verificación para un usuario.
 * `creado_en` se asigna automáticamente a `now()` por Prisma.
 * El hash debe ser Argon2id de un código de 6 dígitos (nunca guardar en claro).
 * @param {string} usuarioId - UUID del usuario (estado PENDIENTE)
 * @param {string} tokenHash - Hash Argon2id del código de 6 dígitos
 * @param {Date} expiraEn - Fecha de expiración (ahora + 15 min)
 * @returns {Promise<TokenVerificacion>} Token creado con `id`, `creado_en`, `expira_en`
 */
export async function createToken(
  usuarioId: string,
  tokenHash: string,
  expiraEn: Date,
): Promise<TokenVerificacion> {
  return prisma.tokenVerificacion.create({
    data: {
      usuarioId,
      tokenHash,
      expiraEn,
    },
  });
}

/**
 * Busca el token de verificación más reciente **sin usar** de un usuario.
 * Ordenado por `creado_en DESC`; filtra `usadoEn = null`.
 * Usado para: rate limit de reenvío (validar `creado_en`) y verificación.
 * @param {string} usuarioId - UUID del usuario
 * @returns {Promise<TokenVerificacion | null>} Token más reciente o `null` si no existe
 */
export async function findLatestByUsuarioId(
  usuarioId: string,
): Promise<TokenVerificacion | null> {
  return prisma.tokenVerificacion.findFirst({
    where: {
      usuarioId,
      usadoEn: null,
    },
    orderBy: {
      creadoEn: "desc",
    },
  });
}

/**
 * Marca un token como usado estableciendo `usado_en = now()`.
 * Invalidación suave (soft delete) para preservar rastro de auditoría.
 * Se invoca tras verificación exitosa o al emitir un nuevo token (reenvío).
 * @param {string} id - UUID del token a invalidar
 * @returns {Promise<TokenVerificacion>} Token actualizado con `usado_en` seteado
 */
export async function markUsed(id: string): Promise<TokenVerificacion> {
  return prisma.tokenVerificacion.update({
    where: { id },
    data: {
      usadoEn: new Date(),
    },
  });
}