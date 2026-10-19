# Feature POS (`packages/features/pos`)

> Estado: vigente 2026-10-18

## Qué es

Punto de venta cashless presencial: 9 componentes, `usePosSession`, `useThermalPrinter`, `posCheckout` (deps inyectadas), `receipt`, `ticketReprint`, types. Rol Vendedor/Admin.

Es el **único** lugar donde se imprimen tickets: `useThermalPrinter` envía el ticket de 58 mm a la DIG-ISH58 por Bluetooth o USB, la que empareje el operador (`@sportcomplex/printing`), `PosTicketPreview` lo muestra 1:1 y `PosReprintPanel` imprime reservas ya hechas a partir del QR del pase ([ADR 009](../../../docs/architecture/adrs/009-impresion-termica-navegador.md)).

## Estructura / Exports

```
src/{components,hooks,services,types}/
src/hooks/usePosSession.ts
src/hooks/useThermalPrinter.ts
src/services/posCheckout.ts
src/services/ticketReprint.ts
src/components/billing/{PosVoucherModal,PosTicketPreview,PosTicketPrintActions,PosReprintPanel}.tsx
```

Deps: `ui`, `booking`, `core`, `printing`. Exports: `.`, `./components`, `./hooks`, `./services`, `./types`.

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
- No llevar la impresión térmica al portal del cliente: el cliente solo descarga el PDF.
- No dibujar el ticket con datos del navegador: siempre desde `GET /api/pdf/receipt?destinatario=POS`.

## Testing

```bash
pnpm --filter @sportcomplex/features-pos test
pnpm --filter @sportcomplex/features-pos typecheck
```

46 tests co-locados.

## Ref docs

- `packages/features/README.md`, `docs/architecture/packages-features.md`, `docs/features/pagos-pos.md`
