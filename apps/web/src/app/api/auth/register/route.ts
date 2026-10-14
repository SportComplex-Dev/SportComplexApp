import { fail, ok } from "@/lib/api-response";
import { registerSchema } from "@sportcomplex/validation";
import {
  hashSecret,
  generateVerificationCode,
  TOKEN_TTL_MS,
} from "@sportcomplex/security";
import { sendVerificationCodeEmail } from "@sportcomplex/security";
import { prisma, createToken } from "@sportcomplex/db";
import {
  createSupabaseAuthUser,
  deleteSupabaseAuthUser,
  findSupabaseUserByEmail,
  isSupabaseAdminConfigured,
} from "@/lib/supabase/admin";

const DUPLICATE_EMAIL_HINT = /already been registered|already been taken|user_already_exists|email_exists/i;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de registro inválidos", 400, parsed.error.flatten());
    }

    const { email, password, nombre } = parsed.data;
    const correo = email.toLowerCase().trim();

    const existing = await prisma.usuario.findUnique({ where: { correo } });
    if (existing) {
      return fail("EMAIL_EXISTS", "El correo ya está registrado", 409);
    }

    const clienteRole = await prisma.rol.findUnique({ where: { nombre: "CLIENTE" } });
    if (!clienteRole) {
      return fail("CONFIG_ERROR", "Rol CLIENTE no configurado", 500);
    }

    // 1. Crear la identidad en Supabase Auth con email confirmado por Admin API (D4=b).
    let supabaseUserId: string | null = null;
    if (isSupabaseAdminConfigured()) {
      const { data, error } = await createSupabaseAuthUser({ email: correo, password, nombre });

      if (error) {
        const duplicate = DUPLICATE_EMAIL_HINT.test(error.message ?? "");
        // Huérfano Auth (intento previo falló la inserción en `usuario`): se recupera
        // creando la fila; el flujo de 6 dígitos sigue siendo la puerta de activación.
        const orphan = duplicate ? await findSupabaseUserByEmail(correo) : null;
        if (duplicate && orphan?.data?.user) {
          supabaseUserId = orphan.data.user.id;
        } else {
          return fail("EMAIL_EXISTS", "El correo ya está registrado", 409);
        }
      } else {
        supabaseUserId = data?.user?.id ?? null;
      }
    }

    const passwordHash = await hashSecret(password);

    const usuario = await prisma.usuario
      .create({
        data: {
          correo,
          passwordHash,
          nombre,
          rolId: clienteRole.id,
          estado: "PENDIENTE",
        },
      })
      .catch(async (error: unknown) => {
        // Rollback best-effort de la identidad Auth si falla la fila DB (sin huérfanos).
        if (supabaseUserId) {
          try {
            await deleteSupabaseAuthUser(supabaseUserId);
          } catch {
            // el error original de DB es el que debe propagarse
          }
        }
        throw error;
      });

    const code = generateVerificationCode();
    const tokenHash = await hashSecret(code);
    const expiraEn = new Date(Date.now() + TOKEN_TTL_MS);

    await createToken(usuario.id, tokenHash, expiraEn);

    // El código en claro nunca se persiste; se envía al webhook de correo (TSK-AU-01).
    await sendVerificationCodeEmail({ usuarioId: usuario.id, to: correo, nombre, code, expiraEn });

    return ok({
      usuarioId: usuario.id,
      message: "Registro exitoso. Verifica tu correo con el código de 6 dígitos.",
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
