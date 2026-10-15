# Packages `features/*` + `shared` — Migración modular L3 (2026-10-14/15)

Migración de código feature desde `apps/web/src` a paquetes workspace, ejecutada en
células L3 sobre `refactor/hyper-plan-arquitectura`. Contratos corregidos contra código
real en `cells-mailbox/*/inbox/001-contrato.json` (v1-corrected-2026-10-14).

## Mapa de paquetes

| Paquete | Contenido | Consume | Tests |
|---|---|---|---|
| `@sportcomplex/features-booking` | 8 componentes (AvailabilityCalendar, CheckoutTimer, ServiceSelector, Cart, BookingSummaryModal, PaymentMethodSelector, StripePaymentForm, ReservationModal), `usePublicCatalog`, `cartUtils`, `checkoutFlow`, types+Zod | `ui`, `core` | 39 |
| `@sportcomplex/features-tournament` | 5 componentes (StatusBadge, FormModal, DetailModal, RegistrationModal, PublicDetailModal), `tournamentAdmin` (KPIs puros), types incl. `UserTournamentItem` | `ui`, `validation` | 17 |
| `@sportcomplex/features-pos` | 6 componentes (`Pos*`), `usePosSession`, `posCheckout` (handler puro con deps inyectadas), `receipt`, types | `ui`, `booking`, `core` | 20 |
| `@sportcomplex/features-scanner` | 11 componentes, `useScannerController`, `useAudioFeedback`, `scannerService`, types | `ui`, `core`, `shared` | 25 |
| `@sportcomplex/features-portal` | 12 componentes, `useCustomerPortal`, `usePortalTickets`, `portal-utils`, `membership-utils`, types (re-exporta `UserTournamentItem` y `CartItem`, no duplica) | `ui`, `booking`, `tournament` | 59 |
| `@sportcomplex/shared` | `qr-client` (parse QR + guards estrictos), `use-network-resilience` (retry+cache genérico) | — (peer `react`) | 4 |
| `@sportcomplex/ui` | Primitivas: Button, Card, Dialog, Badge, Input, Modal, ActionButton, TicketReceipt, `cn` | `lucide-react`, `motion` | 13 |

DAG: `ui` ← `shared` ← `booking` ← `pos`; `tournament` ← `portal` (+`booking`).

## Reglas que rigen estos paquetes

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

## Evidencia Integration Gate (2026-10-15, `6aab760`)

- `pnpm build`: **16/16**
- `pnpm typecheck`: exit 0
- `pnpm verificar:limites`: **0 infracciones**
- `pnpm test`: ui 13, tournament 17, security 6, application 22, db 109, core 77,
  scanner 25, booking 39, pos 20, portal 59, shared 4, web 278 — **0 fail**

## Pendiente (no bloquea el Gate)

- **Backfill unit tests**: booking 2 (`PaymentMethodSelector`, `ReservationModal`),
  tournament 5, pos 6, scanner 11 colocados pendientes (portal ya 12/12).
- **Deduplicar QR**: `QrModal`/`PortalQrModal`/`TicketQrModal` + `QRGraphicHD` + `PrintableReceipt`
  → un componente parametrizado.
- **Schemas Zod**: `features/*/types` redefinen schemas que ya existen en
  `packages/validation` — importar en vez de redefinir.
- **Chrome web→ui**: borrar `apps/web/src/components/modal.tsx` y `action-button.tsx`
  tras migrar sus consumidores a `@sportcomplex/ui`.
- **Backlog tech-lead**: `middleware.ts` → `proxy.ts` (convención Next 16; `middleware`
  aún soportado en 16.3.7). Rename + build real + smoke 307 por rol. Rollback 1 commit.
