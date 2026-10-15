# Contratos Zod (`packages/validation`)

> Estado: vigente 2026-10-15

## Qué es

Contratos únicos de entrada/salida con **Zod 4 solo** (sin `zod/v3` ni Yup). Dos familias: `platform/` (auth, access, bot, contingency) y `business/` (booking, payment, service, automation, analytics, tournament). Fuente del OpenAPI.

## Estructura / Exports

```
src/platform/{auth,access,bot,contingency}.schema.ts
src/business/{booking,payment,service,automation,analytics,tournament}.schema.ts
src/index.ts  # re-exporta *.schema
```

Un solo entry `.`. `bookingRequestSchema` se re-exporta para `features-booking`.

## Cómo usar

```ts
import { bookingRequestSchema } from "@sportcomplex/validation";

const r = bookingRequestSchema.safeParse(body);
if (!r.success) return fail("VALIDATION_ERROR", "Datos inválidos", 400, r.error.flatten());
```

## Límites (No hacer)

- No usar otra lib de validación ni `any` para saltar el schema.
- No poner lógica de BD/fechas aquí (solo schemas + `.refine` puros).
- No duplicar schemas entre web y features (importar de aquí).

## Testing

```bash
pnpm --filter @sportcomplex/validation test
pnpm docs:openapi
```

## Ref docs

- `docs/api/rest.md` (Zod→OpenAPI), `docs/features/reservas.md`, `docs/features/auth.md`
