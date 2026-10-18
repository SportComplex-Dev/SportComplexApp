import { fail, ok } from "@sportcomplex/shared/lib";
import { resetPasswordSchema, type ResetPasswordInput } from "@sportcomplex/validation";
import { hashSecret, isPasswordResetTokenCurrent, verifyPasswordResetToken } from "@sportcomplex/security";
import { findPasswordResetUser, updatePasswordHash } from "@sportcomplex/db";
import { updateSupabasePasswordByEmail } from "@/lib/supabase/admin";
import { authGateFor } from "@/lib/auth/auth-gate";

interface ResetPasswordUser {
  id: string;
  correo: string;
  estado: string;
  passwordHash: string | null;
}

interface ResetPasswordDependencies {
  verifyToken(token: string): { userId: string; email: string; credentialVersion: string } | null;
  findUser(userId: string, email: string): Promise<ResetPasswordUser | null>;
  isTokenCurrent(tokenVersion: string, passwordHash: string | null): boolean;
  hashPassword(password: string): Promise<string>;
  updateAuthPassword(email: string, password: string): Promise<boolean>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<unknown>;
}

const defaultDependencies: ResetPasswordDependencies = {
  verifyToken: verifyPasswordResetToken,
  findUser: findPasswordResetUser,
  isTokenCurrent: isPasswordResetTokenCurrent,
  hashPassword: hashSecret,
  updateAuthPassword: updateSupabasePasswordByEmail,
  updatePasswordHash,
};

export async function handleResetPassword(
  request: Request,
  dependencies: ResetPasswordDependencies = defaultDependencies,
) {
  // Endpoint público por diseño: el token firmado es la credencial temporal de autorización.
  const body = await request.json().catch(() => ({}));
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Token y nueva contraseña inválidos", 400, parsed.error.flatten());

  let claims: ReturnType<ResetPasswordDependencies["verifyToken"]>;
  try {
    claims = dependencies.verifyToken(parsed.data.token);
  } catch (error) {
    console.error("Error al validar token de restablecimiento:", error instanceof Error ? error.message : "unknown");
    return fail("RESET_FAILED", "No se pudo restablecer la contraseña", 500);
  }
  if (!claims) return fail("INVALID_RESET_TOKEN", "El enlace de restablecimiento es inválido o expiró", 400);

  try {
    const usuario = await dependencies.findUser(claims.userId, claims.email);
    if (
      !usuario ||
      authGateFor(usuario.estado, false).gate !== "OK" ||
      !dependencies.isTokenCurrent(claims.credentialVersion, usuario.passwordHash)
    ) {
      return fail("INVALID_RESET_TOKEN", "El enlace de restablecimiento es inválido o expiró", 400);
    }
    const input: ResetPasswordInput = parsed.data;
    const passwordHash = await dependencies.hashPassword(input.password);
    const authPasswordUpdated = await dependencies.updateAuthPassword(usuario.correo, input.password);
    if (!authPasswordUpdated) throw new Error("No se pudo actualizar la contraseña en Auth");
    await dependencies.updatePasswordHash(usuario.id, passwordHash);
    return ok({ message: "La contraseña se restableció correctamente." });
  } catch (error) {
    console.error("Error al restablecer contraseña:", error instanceof Error ? error.message : "unknown");
    return fail("RESET_FAILED", "No se pudo restablecer la contraseña", 500);
  }
}

export async function POST(request: Request) {
  return handleResetPassword(request);
}
