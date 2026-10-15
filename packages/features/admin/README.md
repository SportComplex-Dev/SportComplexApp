# Feature admin (`packages/features/admin`)

> Estado: vigente 2026-10-15

## Qué es

Backoffice: `SlotCapacityEditor`, `Dashboard*`, `Employee*` (8 componentes planos) + 2 suites migradas. Solo rol Administrador.

## Estructura / Exports

```
src/components/{SlotCapacityEditor,Dashboard*,Employee*}.tsx
src/components/index.ts
src/index.ts
```

Deps: `ui`, `core`. Exports: `.`, `./components`.

## Cómo usar

```tsx
import { SlotCapacityEditor } from "@sportcomplex/features-admin/components";

<SlotCapacityEditor servicioId={1} franjaId={3} />
```

## Límites (No hacer)

- No exponer sin RBAC (`proxy.ts` + `authorize` en route).
- No importar `booking`/`pos` (admin no depende de ellos).
- No usar `X/X.tsx` ni tests en `__tests__/`.

## Testing

```bash
pnpm --filter @sportcomplex/features-admin test
pnpm --filter @sportcomplex/features-admin typecheck
```

Tests co-locados (`Foo.test.tsx` junto a `Foo.tsx`).

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/catalogo.md`
