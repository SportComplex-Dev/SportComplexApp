---
name: backend-contract
description: Routes delgadas auth-Zod-repo-ok/fail con RBAC proxy más authorize, TTL 30m, ventana Bogota y fire-and-forget a n8n. Usa esta skill cuando crees route.ts, repositorios, webhooks o crons.
---

# backend-contract

> Estado: vigente 2026-10-15

Contrato de toda `route.ts`: delgada, tipada, transaccional donde toca y con respuesta canónica.

## Triggers

- Nueva o modificada `apps/web/src/app/api/*/route.ts`.
- Cambio en `db/repositories`, webhook Stripe/n8n, cron o RBAC.
- Error 4xx/5xx con formato no canónico.
- Nuevo campo con `@map` o cambio de TTL/ventana.

## Reglas oro

1. **Pipeline**: `auth (proxy + authorize)` → **Zod** (`validation.safeParse` → `fail 400`) → **repo** (`db`) → **`ok`/`created`/`fail`**. Sin lógica en la route.
2. **RBAC doble**: `proxy.ts` perimetral (401/403, 307 por rol) + `authorize()` en la route. `internal/*` con `INTERNAL_API_KEY`, `cron/*` con `CRON_SECRET` (fail-closed 503).
3. **`now` inyectable**: firmas `(input, now = new Date())`; ventana `[hoy, hoy+15]` y TTL **30 min** en `America/Bogota` (`@map`: TS `avatar`, SQL `avatar_url`).
4. **SQL solo en `db`**: ocupar cupos solo vía `reserveDisponibilidad()` (`SELECT … FOR UPDATE`); expirar vía `expirations.ts`.
5. **n8n fire-and-forget**: timeout 2.5 s, 0 reintentos en caliente, HMAC `X-SportComplex-Signature`; fallo no revierte la TX (outbox TSK-BE-22b).
6. **Stripe Opción C**: TX1 hold + Checkout Session (30 min); el webhook crea el `PAGO` (`attachPendingPagoToReserva`, idempotente por `stripe_payment_intent_id` + `P2002`).

## Verificación (comandos exactos)

```bash
pnpm --filter @sportcomplex/db typecheck
pnpm --filter @sportcomplex/core typecheck
pnpm --filter @sportcomplex/validation typecheck
pnpm --filter @sportcomplex/security test
pnpm --filter @sportcomplex/db test
pnpm --filter web test
pnpm db:generate
pnpm docs:openapi
```

Tras cambiar `schema.prisma`: `pnpm db:generate` antes de typecheck. Tras cambiar contrato: `pnpm docs:openapi` + commitear diff.

## Anti-patrones

- Lógica de negocio en `route.ts` (precios, franjas, QR) en vez de `core`/`application`/`db`.
- Crear `PAGO` dentro del lock (Opción C: TX1 solo hold + Stripe Session; el webhook crea el pago).
- Columna `locked_at` (no existe; único TTL `expira_en = now + 30 min`).
- Stripe en la TX de BD (compensar con `compensateFailedCheckout`, nunca degradar `CONFIRMADA`).
- Responder `{ ok: true }` ad-hoc en vez de `ok`/`fail` con `timestamp`.
- Usar `avatar_url` en TS (usar `avatar`; snake_case solo en SQL).
- Bypasear `isAvailabilityError → httpStatus` (404/409/422/400).

## Ejemplos

```ts
// Route canónica
import { bookingRequestSchema } from "@sportcomplex/validation";
import { ok, created, fail } from "@sportcomplex/shared/lib";
import { reserveDisponibilidad, isAvailabilityError } from "@sportcomplex/db";

export async function POST(req: Request) {
  const body = await req.json();
  const r = bookingRequestSchema.safeParse(body);
  if (!r.success) return fail("VALIDATION_ERROR", "Datos inválidos", 400, r.error.flatten());
  try {
    const reserva = await reserveDisponibilidad(r.data);
    return created(reserva);
  } catch (e) {
    if (isAvailabilityError(e)) return fail(e.code, e.message, e.httpStatus);
    throw e;
  }
}
```

## Checklist

- [ ] Auth + Zod + repo + `ok`/`fail`; `authorize()` presente.
- [ ] `now` inyectable; ventana/TTL Bogotá correctos.
- [ ] Cupos solo por `reserveDisponibilidad()`; errores mapeados (404/409/422/400).
- [ ] n8n con timeout+HMAC, sin revertir TX; `webhookEnviadoEn` solo tras 2xx.
- [ ] `pnpm db:generate` + `docs:openapi` regenerado si cambió el contrato.
- [ ] Tests `db` + `web` verdes.

## Ref docs

- `docs/api/rest.md`, `packages/db/README.md`, `packages/db/src/repositories/README.md`, `docs/features/pagos-pos.md`, `docs/automation/webhooks.md`
