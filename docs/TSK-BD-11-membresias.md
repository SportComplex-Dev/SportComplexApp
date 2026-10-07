# TSK-BD-11 — Persistencia de membresías y catálogo de planes (HU-20 / RF-16)

> Rama de trabajo: `feature/tsk-bd-11-persistencia-membresias-catalogo`
> Responsable: Milton Ortega · 3 pts · Fase F0 · Depende de `TSK-BD-06`
> Fecha de implementación: 2026-10-05

## 1. Qué se hizo y por qué

La base de datos **no cumplía** el criterio de aceptación clave de la tarea:

> *Una misma persona no puede tener dos membresías `VIGENTES`; el motor de base de datos lo rechaza.*

El modelo (`PLAN_MEMBRESIA` + `MEMBRESIA`, enums `PeriodicidadPlan` y `EstadoMembresia`,
`stripe_price_id` único) ya existía desde `TSK-BD-06`, pero faltaban tres cosas:

| # | Cambio | Archivo |
|---|--------|---------|
| 1 | Índice único parcial `(usuario_id) WHERE estado = 'VIGENTE'` — **el criterio de aceptación** | `packages/db/prisma/migrations/20261005180000_membresia_vigente_uniq/migration.sql` |
| 2 | `CHECK (descuento_pct = 30.00)` en `plan_membresia` (RN-08). Antes era solo `DEFAULT 30.00`, así que se podía insertar cualquier valor | misma migración |
| 3 | Renombrar columna `membresia."fechaInicio"` (camelCase) → `"fecha_inicio"` (snake_case, como el resto del esquema y el DER §4) + `@map("fecha_inicio")` en el modelo Prisma | misma migración + `packages/db/prisma/schema.prisma` |

Además la migración normaliza un dato legacy previo al `CHECK`:
`plan id=1 "VIP Mensual"` tenía `descuento_pct = 15.00` → se actualizó a `30.00`.

### Por qué SQL raw y no solo `schema.prisma`

Prisma **no expresa índices parciales (`WHERE`) ni `CHECK` de forma declarativa**.
Por eso el índice y el `CHECK` viven en la migración SQL y en `schema.prisma`
solo hay comentarios que lo documentan (modelos `PlanMembresia` y `Membresia`).
**No agregues `@@unique([usuarioId])` global**: bloquearía el historial
(`VENCIDA`/`CANCELADA`) y rompería la regla de negocio.

## 2. Cómo usarlo — guía para el equipo

### 2.1. Regla de nombres TS ↔ SQL (obligatoria)

En TypeScript usa camelCase (campos del modelo Prisma); en SQL directo usa
snake_case (columnas reales):

| Prisma Client (TS) | SQL directo (psql, Supabase, n8n) |
|---|---|
| `fechaInicio` | `fecha_inicio` |
| `proximaRenovacion` | `proxima_renovacion` |
| `stripeSubscriptionId` | `stripe_subscription_id` |
| `descuentoPct` / `stripePriceId` | `descuento_pct` / `stripe_price_id` |

```ts
// ✅ Correcto
await prisma.membresia.create({
  data: {
    usuarioId: userId,
    planId: plan.id,
    estado: "VIGENTE",
    fechaInicio: new Date("2026-10-05"),      // Date; la columna es DATE
    proximaRenovacion: new Date("2026-11-05"),
  },
});
```

```sql
-- SQL directo: columnas reales
SELECT usuario_id, estado, fecha_inicio, proxima_renovacion
FROM "membresia" WHERE usuario_id = '...';
```

### 2.2. Flujo recomendado: vender / renovar una membresía

```ts
import { prisma } from "@sportcomplex/db";

// 1. ¿Ya tiene una VIGENTE? (lectura previa para dar buen mensaje UX;
//    la garantía real la da el índice parcial, esto es solo UX)
const vigente = await prisma.membresia.findFirst({
  where: { usuarioId, estado: "VIGENTE" },
});
if (vigente) throw new Error("El usuario ya tiene una membresía vigente");

// 2. Crear la membresía (el motor rechaza la concurrencia por ti)
try {
  await prisma.membresia.create({
    data: { usuarioId, planId, estado: "VIGENTE",
            fechaInicio: new Date(), proximaRenovacion: fechaFin },
  });
} catch (e: any) {
  // Prisma P2002 = violación de unique (incluye el índice parcial).
  // En SQL raw el código es 23505.
  if (e?.code === "P2002") throw new Error("Membresía vigente duplicada");
  throw e;
}
```

Renovar = marcar la anterior como `VENCIDA`/`CANCELADA` y crear la nueva `VIGENTE`
(en una transacción). Nunca coexisten dos `VIGENTE` del mismo usuario.

### 2.3. Reserva con descuento de miembro (30 %)

```ts
// Solo si existe membresía VIGENTE en la fecha de la reserva
const m = await prisma.membresia.findFirst({
  where: { usuarioId: titularId, estado: "VIGENTE" },
});
await prisma.reserva.create({
  data: {
    disponibilidadId, titularId, canal: "ONLINE", estado: "PENDIENTE_PAGO",
    cantidadCupos: 1, subtotal, total,
    descuentoPct: m ? 30.00 : 0.00,
    membresiaId: m?.id ?? null,
  },
});
```

### 2.4. Crear un plan (para administradores / seeds)

```ts
await prisma.planMembresia.create({
  data: {
    nombre: "Plan Mensual Estándar",
    periodicidad: "MENSUAL",   // SEMANAL | MENSUAL | ANUAL
    precio: 180.00,
    descuentoPct: 30.00,       // OBLIGATORIO: el CHECK rechaza otro valor (23514)
    stripePriceId: "price_...", // único; null solo en desarrollo local
    activo: true,
  },
});
```

### 2.5. Errores que vas a ver (y qué significan)

| Código Prisma / PG | Cuándo sale | Qué hacer |
|---|---|---|
| `P2002` / `23505` en `membresia` | Segunda `VIGENTE` del mismo `usuario_id` | Es el comportamiento esperado: informa "ya tiene membresía vigente". No es un bug |
| `P2002` en `stripe_price_id` o `stripe_subscription_id` | Price/subscription duplicado | Reutiliza el existente, no crees otro |
| `P2003` / `23503` | `plan_id` o `usuario_id` inexistente | Valida FKs antes de insertar |
| `23514` (`plan_membresia_descuento_pct_check`) | `descuento_pct <> 30.00` | Fija `30.00`; si el negocio cambia la regla, hay que migrar el CHECK, no bypasearlo |

> Nota: `VIGENTE` + `VENCIDA` (o `CANCELADA`) del mismo usuario **sí está permitido**.
> Solo se bloquea `VIGENTE` + `VIGENTE`.

## 3. Comandos (desde la raíz del monorepo)

```bash
# Regenerar el cliente tras tocar schema.prisma (obligatorio tras el @map nuevo)
pnpm --filter @sportcomplex/db db:generate

# Aplicar migraciones pendientes (desarrollo local)
pnpm --filter @sportcomplex/db db:migrate

# Desplegar en CI / VPS (sin reset, solo aplica lo pendiente)
pnpm --filter @sportcomplex/db db:migrate:deploy

# Seeds: roles + catálogo SEMANAL/MENSUAL/ANUAL con 30 %
pnpm --filter @sportcomplex/db db:seed

# Verificación rápida del índice y el CHECK
psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE indexname = 'membresia_usuario_vigente_uniq';"
psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conname = 'plan_membresia_descuento_pct_check';"
```

Recuerda `DATABASE_URL` (pooler) para runtime y `DIRECT_URL` (directa) solo para
migraciones — ver `packages/db/README.md` §2. `schema.prisma` ya mapea
`fecha_inicio`, así que tras `db:generate` el campo TS sigue siendo `fechaInicio`.

## 4. Verificación realizada (2026-10-05, BD Supabase desarrollo)

Migración aplicada con `migrate deploy` (`Database schema is up to date!`),
`prisma generate` + `tsc --noEmit` OK, y test de aceptación 7/7 PASS en
transacciones con `ROLLBACK` (sin datos residuales):

- índice parcial existe · CHECK existe · columna `fecha_inicio` existe
- 1ª `VIGENTE` OK · 2ª `VIGENTE` rechazada `23505` · `VIGENTE`+`VENCIDA` OK
- plan con `descuento_pct = 15` rechazado `23514`
- smoke ORM: `prisma.membresia.findMany` con `include: { plan: true }` OK
