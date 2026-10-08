import { fail, ok } from "@/lib/api-response";
import { registerSchema } from "@sportcomplex/validation";
import {
  hashSecret,
  generateVerificationCode,
  TOKEN_TTL_MS,
  sendVerificationCodeEmail,
} from "@sportcomplex/core";
import { prisma, createToken } from "@sportcomplex/db";

export async function POST(request: Request) {
  try {
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

    if (process.env.NODE_ENV !== "production") {
      console.log(`\n========================================`);
      console.log(`[AUTH-DEV] Código de verificación para ${email}: ${code}`);
      console.log(`========================================\n`);
    }

    // El código en claro nunca se persiste; se envía al webhook de correo (TSK-AU-01).
    await sendVerificationCodeEmail({ usuarioId: usuario.id, to: email, nombre, code, expiraEn });

    return ok({
      usuarioId: usuario.id,
      message: "Registro exitoso. Verifica tu correo con el código de 6 dígitos.",
      devCode: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (error: unknown) {
    console.error("Error en /api/auth/register:", error);
    const isConnError = error instanceof Error && (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("Can't reach database server") ||
      error.message.includes("P1001")
    );
    const message = isConnError
      ? "No se pudo conectar a la base de datos. Por favor verifica que DATABASE_URL esté configurado y accesible."
      : "Error interno al procesar el registro.";
    return fail("DATABASE_ERROR", message, 500);
  }
}