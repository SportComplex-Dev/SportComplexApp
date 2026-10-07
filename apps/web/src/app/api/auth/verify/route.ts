import { fail, ok } from "@/lib/api-response";
import { verifySchema } from "@sportcomplex/validation";
import {
  verifySecret,
  isTokenExpired,
  consumeRateLimit,
  resetRateLimit,
} from "@sportcomplex/core";
import { prisma, findLatestByUsuarioId, markUsed } from "@sportcomplex/db";

/** Intentos máximos de verificación por token antes de invalidarlo. */
const VERIFY_MAX_ATTEMPTS_PER_TOKEN = 5;

/** Techo de peticiones de verificación por IP por minuto (defensa DoS Argon2id). */
const VERIFY_IP_LIMIT_PER_MIN = 30;
const VERIFY_IP_WINDOW_MS = 60 * 1000;

/**
 * Extrae la IP del cliente desde `x-forwarded-for` (proxy/Docker) con
 * respaldo a primer valor de `x-real-ip` o `"unknown"`.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = verifySchema.safeParse(body);

  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Email y código de 6 dígitos requeridos", 400, parsed.error.flatten());
  }

  const { email, code } = parsed.data;

  const usuario = await prisma.usuario.findUnique({
    where: { correo: email },
  });

  if (!usuario) {
    return fail("NOT_FOUND", "Usuario no encontrado", 404);
  }

  if (usuario.estado === "ACTIVO") {
    return fail("ALREADY_VERIFIED", "La cuenta ya está activa", 400);
  }

  // Defensa DoS por IP: cada intento de verificación ejecuta Argon2id.
  const ipCheck = consumeRateLimit(
    `verify:ip:${getClientIp(request)}`,
    VERIFY_IP_LIMIT_PER_MIN,
    VERIFY_IP_WINDOW_MS,
  );
  if (!ipCheck.allowed) {
    return fail(
      "RATE_LIMITED",
      `Demasiadas peticiones de verificación. Reintente en ${ipCheck.retryAfterSeconds} s.`,
      429,
      { retryAfterSeconds: ipCheck.retryAfterSeconds },
    );
  }

  const latestToken = await findLatestByUsuarioId(usuario.id);

  if (!latestToken) {
    return fail("TOKEN_NOT_FOUND", "No hay token de verificación pendiente", 400);
  }

  if (isTokenExpired(latestToken.expiraEn)) {
    return fail("TOKEN_EXPIRED", "El código ha expirado (máximo 15 minutos)", 400);
  }

  // Fuerza bruta: máximo N intentos por vida del token; al exceder se invalida.
  const userKey = `verify:${usuario.id}`;
  const tokenWindowMs = Math.max(
    60 * 1000,
    latestToken.expiraEn.getTime() - latestToken.creadoEn.getTime(),
  );
  const userCheck = consumeRateLimit(userKey, VERIFY_MAX_ATTEMPTS_PER_TOKEN, tokenWindowMs);
  if (!userCheck.allowed) {
    await markUsed(latestToken.id);
    return fail(
      "TOKEN_LOCKED",
      "Demasiados intentos fallidos. Solicite un nuevo código.",
      429,
      { retryAfterSeconds: userCheck.retryAfterSeconds },
    );
  }

  const valid = await verifySecret(latestToken.tokenHash, code);

  if (!valid) {
    return fail("INVALID_CODE", "Código inválido", 401);
  }

  resetRateLimit(userKey);
  await markUsed(latestToken.id);
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { estado: "ACTIVO" },
  });

  return ok({
    message: "Cuenta verificada exitosamente",
  });
}
