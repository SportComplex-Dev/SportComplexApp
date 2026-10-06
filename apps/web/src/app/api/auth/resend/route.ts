import { fail, ok } from "@/lib/api-response";
import { resendSchema } from "@sportcomplex/validation";
import { hashSecret, generateVerificationCode, TOKEN_TTL_MS, isResendAllowed, sendVerificationCodeEmail } from "@sportcomplex/core";
import { prisma, createToken, findLatestByUsuarioId, markUsed } from "@sportcomplex/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Email requerido", 400, parsed.error.flatten());
  }

  const { email } = parsed.data;

  const usuario = await prisma.usuario.findUnique({
    where: { correo: email },
  });

  if (!usuario) {
    return fail("NOT_FOUND", "Usuario no encontrado", 404);
  }

  if (usuario.estado === "ACTIVO") {
    return fail("ALREADY_VERIFIED", "La cuenta ya está activa", 400);
  }

  const latestToken = await findLatestByUsuarioId(usuario.id);

  if (latestToken && !isResendAllowed(latestToken.creadoEn)) {
    return fail("RATE_LIMITED", "Debe esperar 60 segundos antes de reenviar", 429);
  }

  const code = generateVerificationCode();
  const tokenHash = await hashSecret(code);
  const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);

  if (latestToken) {
    await markUsed(latestToken.id);
  }

  await createToken(usuario.id, tokenHash, expiraEn);

  // El código en claro nunca se persiste; se envía al webhook de correo (TSK-AU-01).
  await sendVerificationCodeEmail({ usuarioId: usuario.id, to: email, nombre: usuario.nombre, code, expiraEn });

  return ok({
    message: "Código reenviado. Verifica tu correo con el código de 6 dígitos.",
  });
}