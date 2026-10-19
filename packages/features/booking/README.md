# Feature booking (`packages/features/booking`)

> Estado: vigente 2026-10-15

## Qué es

Catálogo público + carrito + checkout: 8 componentes, `usePublicCatalog`, `cartUtils`, `checkoutFlow`, types (`bookingRequest` de validation). Base que consumen `pos` y `portal`.

## Estructura / Exports

```
src/{components,hooks,services,types,utils}/
src/hooks/usePublicCatalog.ts
src/utils/cartUtils.ts
src/services/checkoutFlow.ts
```

Deps: `ui`, `core`, `validation`. Exports: `.`, `./components`, `./hooks`, `./services`, `./types`, `./utils`.

## Cómo usar

```tsx
import { usePublicCatalog } from "@sportcomplex/features-booking/hooks";
import { checkoutFlow } from "@sportcomplex/features-booking/services";

const { catalogo, franjas } = usePublicCatalog(fecha);
await checkoutFlow(carrito);
```

## Límites (No hacer)

- No fijar `timeSlots` hardcodeados (usar `generarFranjasOperativas` 06:00–22:00).
- No validar con schemas locales si ya existe en `validation`.
- No llamar a Stripe en el lock (ver `backend-contract`).

## Testing

```bash
pnpm --filter @sportcomplex/features-booking test
pnpm --filter @sportcomplex/features-booking typecheck
```

45 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/reservas.md`, `docs/features/catalogo.md`
