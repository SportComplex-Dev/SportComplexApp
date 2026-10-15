# Núcleo de lógica (`packages/core`)

> Estado: vigente 2026-10-15

## Qué es

Lógica pura + adaptadores del negocio: dominio (`catalog`, `analytics`), servicios (`pricing`, `availability`, `pool-policy`, `access-control`), seguridad (`qr`, `rate-limit`) e integraciones (`email`, `nager-date`, `stripe`, `n8n`).

## Estructura / Exports

```
src/domain/       # catalog, analytics (ver src/domain/README.md)
src/services/     # pricing, availability, pool-policy, access-control (ver src/services/README.md)
src/security/{qr,rate-limit}  # token NO va en barrel (nativo Turbopack) → usar @sportcomplex/security
src/integrations/{email,nager-date,stripe,n8n}.ts
src/index.ts
```

Índice: este README apunta a `src/security|integrations|services|domain`.

## Cómo usar

```ts
import { calcularPrecio } from "@sportcomplex/core/services/pricing";
import { verificarQR } from "@sportcomplex/core/security/qr";
// Argon2id: importar desde @sportcomplex/security, no desde core
import { hashSecret } from "@sportcomplex/security/token";
```

## Límites (No hacer)

- No importar `token` (Argon2id) desde el barrel de `core` en web.
- No hacer SQL directo ni `Response.json` aquí (eso es `db`/`shared`).
- No usar imágenes remotas sin localizar ni mocks de catálogo en prod.

> Deuda conocida: `core` depende de `@sportcomplex/db` y `@sportcomplex/seed` (ver `package.json`). Objetivo: invertir hacia `db → core` y dejar `core` puro.

## Testing

```bash
pnpm --filter @sportcomplex/core test
pnpm --filter @sportcomplex/core typecheck
```

## Ref docs

- `src/domain/README.md`, `src/services/README.md`, `src/security/README.md`, `src/integrations/README.md`, `docs/architecture/adrs/006-grafo-dependencias.md`
