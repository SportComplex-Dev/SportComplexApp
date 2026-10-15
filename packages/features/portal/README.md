# Feature portal (`packages/features/portal`)

> Estado: vigente 2026-10-15

## Qué es

Área cliente: 10 componentes con `TicketQrModal` único + `QrGraphic`, 2 hooks, utils y types sin duplicar. Historial, membresías, boletos QR.

## Estructura / Exports

```
src/{components,hooks,types,utils}/
src/components/{TicketQrModal,QrGraphic}.tsx
```

Deps: `ui`, `booking`, `tournament`. Exports: `.`, `./components`, `./hooks`, `./types`, `./utils`.

## Cómo usar

```tsx
import { TicketQrModal } from "@sportcomplex/features-portal/components";

<TicketQrModal open={open} qr={codigoQR} reserva={reserva} onClose={cerrar} />
```

## Límites (No hacer)

- No crear un segundo modal QR (el único es `TicketQrModal`).
- No importar `pos`/`scanner` (portal solo consume `booking`/`tournament`).
- No hacer `fetch` sin `ok`/`fail` de `shared`.

## Testing

```bash
pnpm --filter @sportcomplex/features-portal test
pnpm --filter @sportcomplex/features-portal typecheck
```

57 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/control-acceso.md`
