# Utilidades transversales (`packages/shared`)

> Estado: vigente 2026-10-15

## Qué es

Helpers cliente+servidor compartidos: respuesta API canónica, cliente QR, webhook contingencia, estado persistente, stores y `use-network-resilience`. Solo depende de `core` (tipos).

## Estructura / Exports

```
src/lib/{api-response,qr-client,contingency-webhook,persistent-state,stores}.ts
src/hooks/use-network-resilience.ts
src/{lib,hooks,index}.ts
```

Subpaths: `.`, `./lib`, `./hooks`.

## Cómo usar

```ts
import { ok, created, fail } from "@sportcomplex/shared/lib";

export async function GET() { return ok({ hola: "mundo" }); }
export async function POST() {
  if (!body?.id) return fail("VALIDATION_ERROR", "Falta id", 400);
  return created({ id: body.id });
}
```

Formato canónico: `{ success: true, data, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`.

## Límites (No hacer)

- No hacer fetch directo sin `ok`/`fail`; no duplicar el formato de respuesta en routes.
- No importar `@sportcomplex/db` ni secretos aquí.
- No crear stores fuera de `stores.ts` (una sola fuente).

## Testing

```bash
pnpm --filter @sportcomplex/shared test
pnpm --filter @sportcomplex/shared typecheck
```

## Ref docs

- `docs/architecture/packages-features.md` (DAG `ui ← shared ← booking ← pos`), `docs/api/rest.md`
