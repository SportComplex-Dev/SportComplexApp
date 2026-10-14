# ADR-DB-001: Mapeo y Nomenclatura de Campos Contractuales §4.5 (Compatibilidad y Dominio)

## Estado
Aceptado (Fase 0 - Phase 0 Contract DB v1)

## Contexto
En el marco de la modularización y estabilización de `@sportcomplex/db`, el contrato de Base de Datos v1 (§4.5) requiere documentar la decisión técnica de nomenclatura, compatibilidad y mapeo objeto-relacional para cinco campos críticos:
1. `avatarUrl` (Modelo `Usuario`)
2. `googleSub` (Modelo `Usuario`)
3. `suscripcionStripeId` (Modelo `Membresia`)
4. `webhookEnviadoEn` (Modelo `InhabilitacionServicio`)
5. `precioStripeId` (Modelo `PlanMembresia`)

La célula DB opera bajo una frontera estricta: **no modificar `apps/web`, `core`, `ui`, `config` ni `CI`**. En consecuencia, cualquier cambio en las propiedades expuestas por PrismaClient repercute directamente en los contratos de consumo frontend y backend.

---

## Decisiones Técnicas por Campo

### 1. `avatarUrl` (Tabla `usuario`)
- **Columna SQL (PostgreSQL):** `avatar_url VARCHAR(2048)`
- **Propiedad Prisma:** `avatar String? @map("avatar_url") @db.VarChar(2048)`
- **Decisión:** Mantener la propiedad Prisma como `avatar` mapeada transparentemente a `avatar_url`.
- **Justificación:** Múltiples componentes de autenticación y perfil de usuario en `apps/web` consumen directamente la propiedad `user.avatar`. La columna física en la base de datos ya sigue estrictamente la convención `snake_case` (`avatar_url`), por lo que no existe discrepancia de persistencia. Cambiar el nombre de la propiedad en Prisma introduciría regresiones en el frontend fuera del scope de la célula.

### 2. `googleSub` (Tabla `usuario`)
- **Columna SQL (PostgreSQL):** `google_sub VARCHAR(100) UNIQUE`
- **Propiedad Prisma:** `googleSub String? @unique @map("google_sub") @db.VarChar(100)`
- **Decisión:** Conservar la nomenclatura `googleSub` en Prisma con `@map("google_sub")`.
- **Justificación:** Respeta la especificación OIDC (OpenID Connect `sub` claim) para federación de identidades Google. La columna en PostgreSQL cumple la convención `snake_case`, y la propiedad en TypeScript se adhiere a `camelCase`.

### 3. `suscripcionStripeId` (Tabla `membresia`)
- **Columna SQL (PostgreSQL):** `stripe_subscription_id VARCHAR(100) UNIQUE`
- **Propiedad Prisma:** `stripeSubscriptionId String? @unique @map("stripe_subscription_id") @db.VarChar(100)`
- **Decisión:** Mantener la propiedad en Prisma como `stripeSubscriptionId` con mapeo a `stripe_subscription_id`.
- **Justificación:** Existen más de 30 llamadas directas en rutas de API (`/api/memberships/subscribe`, `/api/payments`), stores y pruebas unitarias que dependen de la clave `stripeSubscriptionId`. La base de datos garantiza unicidad mediante el índice `membresia_stripe_subscription_id_key` y formato `snake_case`. Modificar el identificador de cliente en TypeScript rompería el contrato de integración sin alterar la semántica de datos.

### 4. `webhookEnviadoEn` (Tabla `inhabilitacion_servicio`)
- **Columna SQL (PostgreSQL):** `webhook_enviado_en TIMESTAMPTZ`
- **Propiedad Prisma:** `webhookEnviadoEn DateTime? @map("webhook_enviado_en") @db.Timestamptz`
- **Decisión:** Mantener `webhookEnviadoEn` como identificador de auditoría.
- **Justificación:** Sigue al 100% la convención contractual de español `camelCase` en TypeScript y `snake_case` en PostgreSQL. Se utiliza para trazar la emisión de webhooks de contingencia hacia automatizaciones de notificación.

### 5. `precioStripeId` (Tabla `plan_membresia`)
- **Columna SQL (PostgreSQL):** `stripe_price_id VARCHAR(100) UNIQUE`
- **Propiedad Prisma:** `stripePriceId String? @unique @map("stripe_price_id") @db.VarChar(100)`
- **Decisión:** Mantener la propiedad Prisma como `stripePriceId` con mapeo a `stripe_price_id`.
- **Justificación:** Alineado con la terminología de Stripe API (`Price ID`), consumido por componentes de checkout y utilitarios de membresías. Garantiza compatibilidad sin fricciones y preserva la integridad relacional con índice único en SQL.

---

## Consecuencias y Verificación
- **Integridad:** Las tablas en PostgreSQL respetan estrictamente la convención `snake_case` en el 100% de las columnas e índices.
- **Retrocompatibilidad:** Ninguna capa externa (`apps/web`, `core`, etc.) sufre cambios de contrato ni errores de compilación de tipos.
- **Mantenibilidad:** El código del repositorio queda documentado y trazable para futuras células.
