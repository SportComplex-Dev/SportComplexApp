# Seguridad (`packages/security`)

> Estado: vigente 2026-10-16

## Qué es

Primitivas de seguridad server-side: QR firmado (HMAC), tokens Argon2id, rate-limit, Stripe helpers, correo y festivos. Lo que usa nativo (`@node-rs/argon2`) vive aquí, no en el barrel de `core`.

## Estructura / Exports

```
src/{qr,token,limite-tasa,stripe,correo,festivos}/index.ts
src/index.ts  # namespace + re-export directo
```

Subpaths: `.`, `./qr`, `./token`, `./limite-tasa`, `./stripe`, `./correo`, `./festivos`.

## Cómo usar

```ts
import { hashSecret, verifySecret, generateVerificationCode } from "@sportcomplex/security/token";
import { firmarQR, verificarQR } from "@sportcomplex/security/qr";

const code = generateVerificationCode();
const hash = await hashSecret(code);
```

Password reset uses a short-lived HMAC token, bound to the current local password
hash so successful resets invalidate previously issued links:

```ts
import { createPasswordResetToken, verifyPasswordResetToken } from "@sportcomplex/security/token";

const token = createPasswordResetToken({ id, email, passwordHash }, now);
const claims = verifyPasswordResetToken(token, now);
```

`AUTH_RESET_TOKEN_SECRET` must be a server-only secret of at least 32 characters.
Reset email dispatch uses `N8N_PASSWORD_RESET_WEBHOOK_URL` and signs the exact JSON
body in `X-SportComplex-Signature` with `N8N_PASSWORD_RESET_HMAC_SECRET` (also
at least 32 characters). Delivery uses a 2.5 s timeout and no retries.

## Límites (No hacer)

- No importar desde cliente/edge ni desde `apps/web` (solo server).
- No loguear secretos ni códigos en claro; no persistir sin hash.
- No usar `token` de `core` en Turbopack (importar desde aquí).

## Testing

```bash
pnpm --filter @sportcomplex/security test
pnpm --filter @sportcomplex/security typecheck
```

## Ref docs

- `docs/features/auth.md` (OTP/rate-limit), `docs/features/control-acceso.md` (QR), `docs/api/rest.md`
