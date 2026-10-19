# Features por dominio (`packages/features`)

> Estado: vigente 2026-10-15

## Qué es

UI + hooks + servicios por rol, migrados desde `apps/web/src` (L3 2026-10-14/15). Cada subpaquete tiene layout plano `src/<categoria>/Foo.ts(x)` + `Foo.test` co-locado + barrel.

## Estructura / Exports

```
admin/      # backoffice (ver packages/features/admin/README.md)
booking/    # catálogo + carrito + checkout (…/booking/README.md)
portal/     # área cliente + QR (…/portal/README.md)
pos/        # punto de venta cashless (…/pos/README.md)
scanner/    # control de acceso QR (…/scanner/README.md)
tournament/ # torneos e inscripciones (…/tournament/README.md)
```

DAG: `ui` ← `shared` ← `booking` ← `pos`; `tournament` ← `portal` (+`booking`).

## Cómo usar

```tsx
import { CatalogoGrid } from "@sportcomplex/features-booking/components";
import { TicketQrModal } from "@sportcomplex/features-portal/components";
```

## Límites (No hacer)

- No importar `apps/web/src` (todo por `@sportcomplex/*`); no carpetas `X/X.tsx` ni `__tests__/`.
- No crear proxies puente (`export * from "./X/index"`); barrels solo re-exportan categorías.
- No duplicar chrome (`Modal`) ni QR (`TicketQrModal` único en portal).

## Testing

```bash
pnpm --filter @sportcomplex/features-booking test
pnpm --filter @sportcomplex/features-portal test
pnpm verificar:limites
```

Cada paquete: `test` co-locado desde su dir; web desde `apps/web`.

## Ref docs

- `docs/architecture/packages-features.md` (mapa, reglas, gate), fichas de cada subpaquete
