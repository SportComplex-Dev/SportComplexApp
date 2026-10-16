import { ok } from "@sportcomplex/shared/lib";
import { forgotPasswordSchema } from "@sportcomplex/validation";
import { createPasswordResetToken, sendPasswordResetEmail } from "@sportcomplex/security";
import { findPasswordResetUserByEmail } from "@sportcomplex/db";

const GENERIC_MESSAGE = "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";

interface ResetUser {
  id: string;
  correo: string;
  nombre: string;
  passwordHash: string | null;
}

interface ForgotPasswordDependencies {
  findUserByEmail(email: string): Promise<ResetUser | null>;
  createToken(user: ResetUser, now: Date): string;
  sendEmail(input: { usuarioId: string; to: string; nombre: string; resetUrl: string }): Promise<void>;
  appUrl?: string;
  now?: () => Date;
}

const defaultDependencies: ForgotPasswordDependencies = {
  findUserByEmail: findPasswordResetUserByEmail,
  createToken: (user, now) => createPasswordResetToken({ id: user.id, email: user.correo, passwordHash: user.passwordHash }, now),
  sendEmail: sendPasswordResetEmail,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
};

export async function handleForgotPassword(request: Request, dependencies = defaultDependencies) {
  const body = await request.json().catch(() => ({}));
  const parsed = forgotPasswordSchema.safeParse(body);
  if (parsed.success) {
    try {
      const email = parsed.data.email.trim().toLowerCase();
      const usuario = await dependencies.findUserByEmail(email);
      if (usuario) {
        const now = dependencies.now?.() ?? new Date();
        const token = dependencies.createToken(usuario, now);
        const baseUrl = dependencies.appUrl;
        if (baseUrl) {
          void dependencies.sendEmail({
            usuarioId: usuario.id,
            to: usuario.correo,
            nombre: usuario.nombre,
            resetUrl: `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`,
          }).catch((error: unknown) => console.warn("[auth] reset email dispatch failed:", error instanceof Error ? error.message : "unknown"));
        }
      }
    } catch (error) {
      console.error("Error al solicitar restablecimiento de contraseña:", error instanceof Error ? error.message : "unknown");
    }
  }
  return ok({ message: GENERIC_MESSAGE });
}

export async function POST(request: Request) {
  // Endpoint público por diseño: cualquier visitante puede solicitar la recuperación.
  return handleForgotPassword(request);
}
