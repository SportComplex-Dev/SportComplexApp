import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

type PasswordResetClaims = { sub: string; email: string; exp: number; jti: string; credentialVersion: string };

function secret(): string {
  const value = process.env.AUTH_RESET_TOKEN_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_RESET_TOKEN_SECRET debe tener al menos 32 caracteres.");
  }
  return value;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createPasswordResetToken(
  user: { id: string; email: string; passwordHash: string | null },
  now = new Date(),
): string {
  const claims: PasswordResetClaims = {
    sub: user.id,
    email: user.email,
    exp: now.getTime() + PASSWORD_RESET_TTL_MS,
    jti: randomUUID(),
    credentialVersion: createHmac("sha256", secret()).update(user.passwordHash ?? "no-local-password").digest("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload, secret())}`;
}

export function verifyPasswordResetToken(token: string, now = new Date()): { userId: string; email: string; credentialVersion: string } | null {
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(sign(payload, secret()));
    const actual = Buffer.from(signature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<PasswordResetClaims>;
    if (
      typeof claims.sub !== "string" || typeof claims.email !== "string" ||
      typeof claims.exp !== "number" || claims.exp <= now.getTime() ||
      typeof claims.jti !== "string" || typeof claims.credentialVersion !== "string"
    ) return null;
    return { userId: claims.sub, email: claims.email, credentialVersion: claims.credentialVersion };
  } catch {
    return null;
  }
}

export function isPasswordResetTokenCurrent(tokenVersion: string, currentPasswordHash: string | null): boolean {
  try {
    const current = Buffer.from(createHmac("sha256", secret()).update(currentPasswordHash ?? "no-local-password").digest("base64url"));
    const supplied = Buffer.from(tokenVersion);
    return current.length === supplied.length && timingSafeEqual(current, supplied);
  } catch {
    return false;
  }
}
