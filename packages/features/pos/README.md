# Feature POS (`packages/features/pos`)

> Estado: vigente 2026-10-15

## Qué es

Punto de venta cashless presencial: 6 componentes, `usePosSession`, `posCheckout` (deps inyectadas), `receipt`, types. Rol Vendedor/Admin.

## Estructura / Exports

```
src/{components,hooks,services,types}/
src/hooks/usePosSession.ts
src/services/posCheckout.ts
```

Deps: `ui`, `booking`, `core`. Exports: `.`, `./components`, `./hooks`, `./services`, `./types`.

## Cómo usar

```tsx
import { usePosSession } from "@sportcomplex/features-pos/hooks";
import { posCheckout } from "@sportcomplex/features-pos/services";

const sesion = usePosSession();
await posCheckout(sesion, { stripe, repo });
```

## Límites (No hacer)

- No acoplar Stripe directo en el componente (inyectar deps en `posCheckout`).
- No bypasear `reserveDisponibilidad()` para ocupar cupos.
- No exponer sin RBAC Vendedor.

## Testing

```bash
pnpm --filter @sportcomplex/features-pos test
pnpm --filter @sportcomplex/features-pos typecheck
```

41 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/pagos-pos.md`
