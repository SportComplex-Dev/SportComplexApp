# Contrato DB — v1 (Phase 0)

## Base
`origin/develop@f961ee1`. Convención español camelCase, mapeo snake_case solo borde Prisma/SQL.

## Entregables
1. Migraciones:
   - `20261015000000_agregar_cliente_stripe_a_usuario`: `stripe_customer_id VARCHAR(100) UNIQUE` + índice. Prisma: `clienteStripeId String? @unique @map("stripe_customer_id")`.
   - `20261015000001_agregar_eliminado_en_a_torneo`: `deleted_at TIMESTAMPTZ` + índice. Prisma: `eliminadoEn DateTime? @map("deleted_at")`. Repos filtran `eliminadoEn: null`.
   - `20261015000002_agregar_actualizado_en_a_inscripcion`: `actualizado_en TIMESTAMPTZ DEFAULT now()` + trigger.
   - `20261015000003_agregar_restricciones_verificacion`: CHECKs capacidad>0, tarifa>=0, descuento=30, precio>=0.
2. CUOTA-001: `packages/db/prisma/seed.ts:131` — resolver categoría por nombre, crear `Canchas/CANCHA`, `Piscinas/PISCINA` si falta, eliminar `?? 1 / ?? 2`. Aceptación: seed verde en BD vacía.
3. `@sportcomplex/db` solo datos: quitar lectura `.env` de web en `client.ts`, exportar `crearClientePrisma(cadenaConexion)`, constantes duplicadas → `domain`. Partir `repositories/bookings.ts (791 líneas)` en `{index,consultas,mutaciones,mapeadores,tipos,errores}`; errores → `domain`.
4. Campos §4.5 (`avatarUrl, googleSub, suscripcionStripeId, webhookEnviadoEn, precioStripeId`): decisión por campo documentada.

## Verificación
`pnpm --filter @sportcomplex/db prisma migrate dev`, `prisma generate`, `pnpm --filter @sportcomplex/db test`, `pnpm typecheck`.
No escribe fuera de `packages/db/**`, `packages/seed/**` (solo sincronización), `docs/architecture/adr-db-*`.
