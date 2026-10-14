# Contrato Backend — v1 (Phase 0)

## Base
`origin/develop@f961ee1`. español camelCase.

## Entregables
1. `@sportcomplex/domain` (cero deps internas): `catalogo, reserva, membresia, usuario, precio, torneo, analitica, acceso, constantes (zonaHoraria, diasVentanaReserva, minutosTtlCheckout)` — tipos puros desde `packages/core/src/domain/*` + `packages/core/src/services/pricing.ts` + `packages/db` constantes.
2. `@sportcomplex/seed`: `catalogo/{datos,mapa-ids,imagenes}`, `sincronizar/{semillaABD,bdASemilla,validar}`, `scripts/{descargar-imagenes,generar-semilla}`. Fuente única IDs §1.6 (`mapaIdServicio`, `obtenerIdBd`, `obtenerSlug`); `core/domain/catalog.ts:388 resolveCatalogServiceId` re-exporta; `cart-utils mapaIdNumericoServicio` migra a `obtenerIdBd`. `validar.ts` semilla↔BD↔mapa para CI.
3. `@sportcomplex/application` (solo `domain+validation`, sin BD): `precio, disponibilidad, control-acceso, politica-piscina, reserva, membresia, torneo` según §2.3.
4. `@sportcomplex/security`: `qr, token, limite-tasa, stripe/{cliente,intento-pago,sesion-checkout,webhooks,tipos} (desde core/integrations/stripe.ts 583 líneas), correo, festivos (desde core/integrations/nager-date)`. Resuelve 7 imports `@sportcomplex/core/src/...` en web.
5. `exports` + build `dist/` por package (§2.8). TS estricto backend: 0 `any` prod.

## APIs (openapi)
- `GET /api/public/catalogo` (cache 60s): `{servicios, categorias}` vía `obtenerServicios({estado:ACTIVO}), obtenerCategorias`.
- Errores: `CREDENCIALES_INVALIDAS, SERVICIO_NO_ENCONTRADO, CUPO_NO_DISPONIBLE, STRIPE_NOT_CONFIGURED, STRIPE_CHECKOUT_FAILED`.

## Verificación
`pnpm --filter @sportcomplex/domain,seed,application,security build`, `pnpm typecheck`, `pnpm test`. No escribe fuera de `packages/domain,seed,application,security,core/**`.
