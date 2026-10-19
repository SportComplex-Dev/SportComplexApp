import { createHash } from "node:crypto";
import { consumeRateLimit } from "@sportcomplex/core";
import { ok } from "@sportcomplex/shared/lib";
import { forgotPasswordSchema } from "@sportcomplex/validation";
import { createPasswordResetToken, sendPasswordResetEmail } from "@sportcomplex/security";
import { findPasswordResetUserByEmail } from "@sportcomplex/db";

const GENERIC_MESSAGE = "Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 10;
const MAX_REQUESTS_PER_EMAIL = 3;

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
  getClientIp?(request: Request): string;
  consumeLimit?(key: string, limit: number, windowMs: number, now: number): boolean;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimitFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function consumeForgotPasswordLimit(key: string, limit: number, windowMs: number, now: number): boolean {
  return consumeRateLimit(key, limit, windowMs, now).allowed;
}

const defaultDependencies: ForgotPasswordDependencies = {
  findUserByEmail: findPasswordResetUserByEmail,
  createToken: (user, now) => createPasswordResetToken({ id: user.id, email: user.correo, passwordHash: user.passwordHash }, now),
  sendEmail: sendPasswordResetEmail,
  appUrl: process.env.NEXT_PUBLIC_APP_URL,
  getClientIp,
  consumeLimit: consumeForgotPasswordLimit,
};

export async function handleForgotPassword(request: Request, dependencies = defaultDependencies) {
  const now = dependencies.now?.() ?? new Date();
  const getIp = dependencies.getClientIp ?? getClientIp;
  const consumeLimit = dependencies.consumeLimit ?? consumeForgotPasswordLimit;
  const ipKey = `forgot-password:ip:${rateLimitFingerprint(getIp(request))}`;
  if (!consumeLimit(ipKey, MAX_REQUESTS_PER_IP, RATE_LIMIT_WINDOW_MS, now.getTime())) {
    return ok({ message: GENERIC_MESSAGE });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = forgotPasswordSchema.safeParse(body);
  if (parsed.success) {
    try {
      const email = parsed.data.email.trim().toLowerCase();
      const emailKey = `forgot-password:email:${rateLimitFingerprint(email)}`;
      if (!consumeLimit(emailKey, MAX_REQUESTS_PER_EMAIL, RATE_LIMIT_WINDOW_MS, now.getTime())) {
        return ok({ message: GENERIC_MESSAGE });
      }

      const usuario = await dependencies.findUserByEmail(email);
      if (usuario) {
        const baseUrl = dependencies.appUrl;
        if (!baseUrl) {
          console.warn("[auth] reset email dispatch skipped: NEXT_PUBLIC_APP_URL is not configured");
        } else {
          const token = dependencies.createToken(usuario, now);
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
