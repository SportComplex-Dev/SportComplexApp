# Contrato Frontend — v1 (Phase 0)

## Base
`origin/develop@f961ee1`. español camelCase.

## Entregables (cero mock en prod; mocks solo `__tests__`, `*.test.*`, `db/test/mocks`)
1. §1.1: `apps/web/src/components/app-provider.tsx:93-106` login solo NextAuth/BD (`fetch /api/auth/callback/credentials`); `apps/web/src/lib/stores.ts:53-60` eliminar `cuentasEjemplo, usarSesionAlmacenada mock, cuentasIniciales`; mantener `usePersistentState` solo `borradorReserva`.
2. §1.2: consumir `GET /api/public/catalogo` en `(public)/page.tsx`; eliminar `catalogoInicial, categoriasServicio` de `@sportcomplex/core`.
3. §1.3: `(admin)/admin/catalog/page.tsx:439-447,458-467` sin fallback mock; `setCatalogo([])` + error + reintentar + esqueleto.
4. §1.4: `(staff)/pos/page.tsx` fetch `/api/admin/services?entidad=servicios`, `/api/bookings?servicioId=&fecha=`, `/api/bookings/history`; eliminar `usarCatalogo, usarReservas, franjasPorDefecto:23-37`.
5. §1.5: `(customer)/portal/book/components/service-selector.tsx` consumir `/api/bookings/availability?fecha=` + `/api/public/catalogo`; eliminar `categoriaPorSlug` local.
6. §1.7: 47+ Unsplash en `core/domain/catalog.ts, facility-showcase.tsx, lifestyle-and-digital-pass.tsx` → `/public/images/catalogo/<slug>.webp` (script usa `packages/seed/scripts/descargar-imagenes.ts`).
7. §3 modularización (page delgado + componentes/ganchos/tipos): `admin/catalog 1156, scanner 1058, portal/tickets 655, portal 482, pos 500`. `core/domain/catalog.ts 411` → delega a backend (no duplicar tipos).
8. `@sportcomplex/ui`: `react/react-dom` solo peer+dev; estructura `componentes/<nombre>/{index,<Nombre>.tsx,<Nombre>.test.tsx}`.

## Verificación
`grep cuentasEjemplo|catalogoInicial|franjasPorDefecto|reservasIniciales` prod → 0; `grep images.unsplash.com` → 0; `pnpm build`, `pnpm typecheck`, `pnpm test`. No escribe fuera de `apps/web/**`, `packages/ui/**`, `public/images/**`.
