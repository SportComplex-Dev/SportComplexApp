# Packages `features/*` + `shared` — Migración modular L3 (2026-10-14/15)

Migración de código feature desde `apps/web/src` a paquetes workspace, ejecutada en
células L3 sobre `refactor/hyper-plan-arquitectura`. Contratos corregidos contra código
real en `cells-mailbox/*/inbox/001-contrato.json` (v1-corrected-2026-10-14).

## Mapa de paquetes

| Paquete | Contenido | Consume | Tests |
|---|---|---|---|
| `@sportcomplex/features-booking` | 8 componentes planos + colocados, `usePublicCatalog`, `cartUtils`, `checkoutFlow`, types (bookingRequest de validation) | `ui`, `core`, `validation` | 45 |
| `@sportcomplex/features-tournament` | 5 componentes planos, `tournamentAdmin`, types incl. `UserTournamentItem` | `ui`, `validation` | 36 |
| `@sportcomplex/features-pos` | 6 componentes, `usePosSession`, `posCheckout` (deps inyectadas), `receipt`, types | `ui`, `booking`, `core` | 41 |
| `@sportcomplex/features-scanner` | 11 componentes planos, `useScannerController`, `useAudioFeedback`, `scannerService`, types | `ui`, `core`, `shared` | 60 |
| `@sportcomplex/features-portal` | 10 componentes (TicketQrModal único + QrGraphic), 2 hooks, utils, types sin duplicar | `ui`, `booking`, `tournament` | 57 |
| `@sportcomplex/shared` | `qr-client`, `use-network-resilience`, `api-response`, `contingency-webhook`, `persistent-state`, `stores` | `core` (solo tipos) | 6 |
| `@sportcomplex/ui` | Primitivas planas: Button, Card, Dialog, Badge, Input, Modal, ActionButton, ConfirmDialog, TicketReceipt, `cn` | `lucide-react`, `motion` | 17 |

DAG: `ui` ← `shared` ← `booking` ← `pos`; `tournament` ← `portal` (+`booking`).

## Reglas que rigen estos paquetes

## Estándar de layout (unificado 2026-10-15)

```
packages/<pkg>/src/<categoria>/
  Foo.ts(x)            # implementación, archivo plano
  Foo.test.ts(x)       # test co-locado junto a su sujeto
  index.ts             # barrel de categoría (exigido por el exports map)
```

1. Archivos planos en el dir de categoría. Prohibidas carpetas de un solo
   archivo (`X/X.tsx`) y directorios `__tests__/`.
2. Tests siempre co-locados; se corren desde el dir del paquete.
3. Prohibidos archivos proxy de re-export (`export * from "./X/index"` puentes).
4. Los barrels solo re-exportan; el `index.ts` raíz re-exporta categorías.
5. Excepción: carpetas de contexto acotado con varios archivos reales
   (`domain/*`, `application/*`, `security/*`) se quedan como categorías.

1. **Sin imports relativos a `apps/web`**: todo consumo cruzado va por `@sportcomplex/*`.
   Verificado: `grep apps/web/src packages/features → solo 1 comentario`.
2. **Chrome genérico vive en `ui`**: `Modal`/`ActionButton` se movieron de `tournament` a `ui`.
   Pendiente Phase 3: `apps/web` debe importarlas de `ui` y borrar sus copias.
3. **`tsconfig.json` de web usa paths `dist` de un solo elemento** (exigencia del build
   Next 16: falla con entradas `[src, dist]`). Los `dist/` se compilan con `rootDir: src`
   obligatorio en cada paquete (sin él, `tsc` emite espejos `apps/`+`packages/` corruptos).
4. **Tests de paquete se corren desde el dir del paquete** (los paths `@db-test/*` solo
   resuelven ahí). Tests web desde `apps/web`.
5. **Typecheck web no es válido en worktrees con `node_modules` por junction**
   (faltan tipos generados de Prisma → cascadas `any`). El Gate web se verifica en
   checkout principal post-merge.
6. **Prohibido debilitar strictness global** para callar errores de worktree
   (`noImplicitAny: false`, anotaciones `: any` en handlers — rechazado en gate).

## Evidencia Integration Gate final (2026-10-15)

- `pnpm build`: **16/16**
- `pnpm typecheck`: exit 0
- `pnpm verificar:limites`: **0 infracciones**
- `pnpm test`: ui 17, tournament 36, security 6, application 22, db 109, core 77,
  scanner 60, booking 45, pos 41, portal 57, shared 6, web 261 — **0 fail**

## Pendiente (no bloquea el Gate)

- **Schemas Zod**: resuelto — `bookingRequestSchema` se re-exporta de
  `packages/validation`; los schemas de bloqueo quedan locales (dominio carrito).
- **Chrome web→ui**: resuelto — `Modal`/`ActionButton`/`ConfirmDialog` en `ui`,
  consumidores migrados, copias web borradas.
- **Deduplicar QR**: resuelto — `TicketQrModal` único + `QrGraphic` extraído;
  `QrModal` muerto y `PortalQrModal` eliminados.
- **Proxy**: resuelto — `apps/web/src/proxy.ts` (Next 16, ruta `ƒ Proxy` en build).
- **Backfill unit tests**: resuelto — booking 45, tournament 36, pos 41,
  scanner 62, portal 57, todos verdes + typecheck limpio.
