# Primitivas UI (`packages/ui`)

> Estado: vigente 2026-10-15

## Qué es

Chrome genérico y primitivas planas React 19 + Tailwind 4 + `motion`: Button, Card, Dialog, Badge, Input, Modal, ActionButton, ConfirmDialog, TicketReceipt, `cn`. Sin lógica de negocio.

## Estructura / Exports

```
src/components/{forms/{Button,Input,ActionButton},dialogs/{Dialog,Modal},display/{Card,Badge}}
src/templates/ticket-receipt.tsx
src/lib/utils.ts  # cn()
src/index.ts
```

Un solo entry `.` (plano, sin subpaths por categoría).

## Cómo usar

```tsx
import { Button, Card, Modal, ConfirmDialog, cn } from "@sportcomplex/ui";

<Modal open={open} onClose={cerrar}><Card>Contenido</Card></Modal>
<Button variant="primary" onClick={reservar}>Reservar</Button>
```

Tokens `--brand-*` y modo oscuro según `docs/architecture/design-system.md`.

## Límites (No hacer)

- No duplicar `Modal`/chrome en `apps/web` (importar de aquí; copias web borradas).
- No importar `core`/`db`/`validation` de negocio ni hacer fetch aquí.
- No crear carpetas `X/X.tsx` ni `__tests__/` (plano + test co-locado).

## Testing

```bash
pnpm --filter @sportcomplex/ui test
pnpm --filter @sportcomplex/ui typecheck
```

## Ref docs

- `docs/architecture/design-system.md` (tokens, tipografía, dark), `docs/architecture/packages-features.md`
