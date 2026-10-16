import { fail, ok } from "@sportcomplex/shared/lib";
import { resetPasswordSchema } from "@sportcomplex/validation";
import { hashSecret, isPasswordResetTokenCurrent, verifyPasswordResetToken } from "@sportcomplex/security";
import { findPasswordResetUser, updatePasswordHash } from "@sportcomplex/db";
import { updateSupabasePasswordByEmail } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Token y nueva contraseña inválidos", 400, parsed.error.flatten());

  const claims = verifyPasswordResetToken(parsed.data.token);
  if (!claims) return fail("INVALID_RESET_TOKEN", "El enlace de restablecimiento es inválido o expiró", 400);

  try {
    const usuario = await findPasswordResetUser(claims.userId, claims.email);
    if (!usuario || !isPasswordResetTokenCurrent(claims.credentialVersion, usuario.passwordHash)) {
      return fail("INVALID_RESET_TOKEN", "El enlace de restablecimiento es inválido o expiró", 400);
    }
    const passwordHash = await hashSecret(parsed.data.password);
    await updateSupabasePasswordByEmail(usuario.correo, parsed.data.password);
    await updatePasswordHash(usuario.id, passwordHash);
    return ok({ message: "La contraseña se restableció correctamente." });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error instanceof Error ? error.message : "unknown");
    return fail("RESET_FAILED", "No se pudo restablecer la contraseña", 500);
  }
}
