# Seguridad (`packages/security`)

> Estado: vigente 2026-10-15

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
