import { fail, ok } from "@/lib/api-response";
import { registerSchema } from "@sportcomplex/validation";
import {
  hashSecret,
  generateVerificationCode,
  TOKEN_TTL_MS,
  sendVerificationCodeEmail,
} from "@sportcomplex/core/server";
import { prisma, createToken } from "@sportcomplex/db";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Datos de registro inválidos", 400, parsed.error.flatten());
  }

  const { email, password, nombre } = parsed.data;

  const existing = await prisma.usuario.findUnique({ where: { correo: email } });
  if (existing) {
    return fail("EMAIL_EXISTS", "El correo ya está registrado", 409);
  }

  const clienteRole = await prisma.rol.findUnique({ where: { nombre: "CLIENTE" } });
  if (!clienteRole) {
    return fail("CONFIG_ERROR", "Rol CLIENTE no configurado", 500);
  }

  const passwordHash = await hashSecret(password);

  const usuario = await prisma.usuario.create({
    data: {
      correo: email,
      passwordHash,
      nombre,
      rolId: clienteRole.id,
      estado: "PENDIENTE",
    },
  });

  const code = generateVerificationCode();
  const tokenHash = await hashSecret(code);
  const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);

  await createToken(usuario.id, tokenHash, expiraEn);

  // El código en claro nunca se persiste; se envía al webhook de correo (TSK-AU-01).
  await sendVerificationCodeEmail({ usuarioId: usuario.id, to: email, nombre, code, expiraEn });

  return ok({
    usuarioId: usuario.id,
    message: "Registro exitoso. Verifica tu correo con el código de 6 dígitos.",
  });
}