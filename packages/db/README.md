# Módulo de Base de Datos (`packages/db`)

Este paquete centraliza la gestión de la base de datos utilizando **Prisma ORM** y **PostgreSQL** para todo el sistema SportComplex.

---

## 🛠️ Lo que se ha implementado en este módulo (TSK-BD-06)

1. **Definición del Esquema (`prisma/schema.prisma`)**:
   - Modelado relacional completo con las **16 tablas** del DER: `ROL`, `USUARIO`, `TOKEN_VERIFICACION`, `CATEGORIA_SERVICIO`, `SERVICIO`, `FRANJA_HORARIA`, `DISPONIBILIDAD`, `FESTIVO`, `RESERVA`, `PAGO`, `TICKET_QR`, `ASIGNACION_PUESTO`, `LECTURA_ACCESO`, `PLAN_MEMBRESIA`, `MEMBRESIA`, `INHABILITACION_SERVICIO`.
   - Enums de dominio robustos (Estados de usuario, categorías de servicio, modalidades de reserva, pagos, membresías, control de accesos, etc.).

2. **Constraints de Integridad y Validación (`CHECK` & `UNIQUE`)**:
   - `CHECK (capacidad_maxima > 0)` en `servicio`.
   - `CHECK (hora_fin > hora_inicio)` en `franja_horaria`.
   - `CHECK (cupos_ocupados BETWEEN 0 AND cupos_totales)` en `disponibilidad`.
   - Constraints `UNIQUE` en: `(servicio_id, franja_id, fecha)` (Disponibilidad), `correo`, `google_sub`, `codigo_uuid` y `reserva_id`.
   - Índices base del DER §5.

3. **Sistema de Semillas (`prisma/seed.ts`)**:
   - Poblamiento automático de **Roles (`ROL`)**: `ADMIN`, `VENDEDOR`, `LECTOR`, `CLIENTE`.
   - Catálogo inicial de **Planes de Membresía (`PLAN_MEMBRESIA`)**: Planes configurados con `descuento_pct = 30.00`.

4. **Configuración de Prisma & Cliente**:
   - Configuración centralizada mediante `prisma.config.ts` y exportación de instancias optimizadas con adaptador PostgreSQL en `src/client.ts`.

---

## 🔁 Idempotencia de pagos (TSK-BD-09)

El repositorio `src/repositories/payments.ts` exporta `procesarPagoWebhook`,
punto de entrada único del webhook de Stripe (`POST /api/payments`):

- Upsert de `PAGO` por `stripe_payment_intent_id` (UNIQUE desde `TSK-BD-06`);
  reintenta la transacción ante `P2002` (carreras concurrentes).
- Confirmación condicional `PENDIENTE_PAGO → CONFIRMADA` y activación
  idempotente de membresías, todo en la misma transacción.
- Reenviar el mismo webhook N veces deja **una sola** fila en `pago` y **una
  sola** reserva `CONFIRMADA`.

Guía completa para backend y frontend: [`docs/TSK-BD-09-idempotencia-pagos-stripe.md`](../../docs/TSK-BD-09-idempotencia-pagos-stripe.md).

---

## 📋 Guía de Uso e Indicaciones para el Equipo (Partners)

### 1. Variables de Entorno (`.env`)
Crea un archivo `.env` dentro de `packages/db/` basado en la siguiente estructura:

```env
DATABASE_URL="postgresql://usuario:contraseña@host-pooler:5432/nombre_db"
DIRECT_URL="postgresql://usuario:contraseña@host-directo:5432/nombre_db"
```

---

### 2. Importante: Uso de `DATABASE_URL` (Pooler) vs `DIRECT_URL` (Directo)

Al configurar tu conexión a PostgreSQL (en proveedores como Supabase, Neon o RDS), existen dos URLs distintas. **Es obligatorio seguir estas pautas:**

#### 🚀 Usar `DATABASE_URL` para la Aplicación y Consultas (Runtime)
- **Qué es:** Conecta a través de un **Connection Pooler** (ej. Supabase Pooler en modo Transaction o Session).
- **Por qué usarla:** Evita agotar el límite máximo de conexiones concurrentes permitidas por PostgreSQL (`too many connections`), reutilizando un pool eficiente de conexiones entre peticiones concurrentes.
- **Uso:** Todo el código de la aplicación y repositorios deben utilizar esta URL.

#### ⚙️ Usar `DIRECT_URL` Exclusivamente para Migraciones
- **Qué es:** Conexión directa y sin intermediarios al servidor de base de datos principal.
- **Cuándo usarla:** Configurada en `prisma.config.ts` exclusivamente para ejecutar operaciones DDL y migraciones de esquema (`prisma migrate dev` o `prisma migrate deploy`).
- **Por qué:** Las migraciones requieren bloqueos de esquema y transacciones a nivel de sesión que los connection poolers en modo transacción rechazan.

---

### 3. Sistema de Seeds (`prisma/seed.ts`)

Para poblar la base de datos con los roles institucionales y el catálogo inicial de planes con 30% de descuento:
```bash
pnpm --filter @sportcomplex/db db:seed
```

---

### 4. Comandos Principales

Ejecuta estos comandos desde la raíz del monorepo o filtrando por paquete:

- **Generar cliente de Prisma:**
  ```bash
  pnpm --filter @sportcomplex/db db:generate
  ```
- **Crear y aplicar nueva migración (en desarrollo):**
  ```bash
  pnpm --filter @sportcomplex/db db:migrate
  ```
- **Desplegar migraciones en producción / CI:**
  ```bash
  pnpm --filter @sportcomplex/db db:migrate:deploy
  ```
- **Poblar datos iniciales (Seeds):**
  ```bash
  pnpm --filter @sportcomplex/db db:seed
  ```
- **Abrir Prisma Studio (Interfaz visual de BD):**
  ```bash
  pnpm --filter @sportcomplex/db db:studio
  ```

---

### 5. Uso del esquema en código Backend (TS) — `avatar` vs `avatar_url`

El modelo `Usuario` (`prisma/schema.prisma`) usa `@map` para traducir nombres entre TypeScript y la base de datos:

```prisma
model Usuario {
  // ...
  avatar String? @map("avatar_url") @db.VarChar(2048)
  // ...
  @@map("usuario")
}
```

**Regla clave:**
- **En TypeScript (Prisma Client): usar siempre `.avatar`** ← nombre del campo del modelo.
- **En SQL directo (Supabase SQL Editor, n8n, psql): usar `avatar_url`** ← nombre real de la columna.

```ts
// ✅ Correcto (Prisma Client)
const u = await prisma.usuario.findUnique({ where: { id } });
u?.avatar;

await prisma.usuario.update({
  where: { id },
  data: { avatar: "https://cdn.ejemplo.com/avatares/1.png" },
});

// ❌ Incorrecto — error de compilación (no existe en el tipo generado)
u?.avatar_url;
```

```sql
-- SQL directo (columna real en la BD)
SELECT avatar_url FROM "usuario" WHERE id = '...';
UPDATE "usuario" SET avatar_url = 'https://...' WHERE id = '...';
```

**Notas:**
- `avatar_url` admite máximo **2048 caracteres** y es nullable.
- La misma regla aplica a todos los campos mapeados: en TS usa camelCase (`passwordHash`, `googleSub`, `creadoEn`), en SQL usa snake_case (`password_hash`, `google_sub`, `creado_en`).
- Si alguien modifica `schema.prisma`, ejecutar `pnpm --filter @sportcomplex/db db:generate` para regenerar los tipos del cliente.

---

### 6. Cuentas de prueba (BD de desarrollo en Supabase)

Existen estas cuentas en la tabla `usuario` (verificadas el 2026-10-05):

| Correo | Rol | Estado |
|---|---|---|
| test@example.com | CLIENTE | ACTIVO |
| admin@example.com | ADMIN | ACTIVO |
| cliente@sportcomplex.com | CLIENTE | ACTIVO |
| admin@sportcomplex.com | ADMIN | ACTIVO |
| vendedor@example.com | VENDEDOR | PENDIENTE |
| lector@example.com | LECTOR | PENDIENTE |

**Importante:**
- Todas autentican por **correo + contraseña** (`password_hash` con bcrypt, sin Google OAuth).
- Las contraseñas en texto plano **no están en este repo** (solo existen los hashes). Si las necesitas, pídelas a quien creó las cuentas o resetea una con un hash nuevo.
- `vendedor@example.com` y `lector@example.com` están en estado **PENDIENTE**: no podrán iniciar sesión hasta activarse.
- Para listarlas en cualquier momento:
  ```sql
  SELECT u.nombre, u.correo, u.estado, r.nombre AS rol
  FROM "usuario" u LEFT JOIN "rol" r ON r.id = u.rol_id
  ORDER BY u."creado_en" DESC;
  ```

---

### 7. Notas de entorno (pnpm, dotenv, conexión)

1. **Gestor de paquetes:** el monorepo exige **pnpm 12.6.0** (ver `packageManager` en el `package.json` raíz). No uses `npm install`. Si `pnpm` no está instalado:
   ```bash
   npm install -g --prefix "$HOME/.local" pnpm@12.6.0
   export PATH="$HOME/.local/bin:$PATH"  # agrégalo a tu ~/.bashrc
   ```
2. **`dotenv` es obligatorio** en `@sportcomplex/db` porque `prisma.config.ts` lo importa para cargar el `.env` (Prisma 7 ya no lo carga automáticamente). Si ves `Cannot find module 'dotenv/config'`, instala dependencias con pnpm.
3. **Conexión a Supabase:** la conexión directa (`db.<ref>.supabase.co:5432`) solo resuelve por **IPv6**. Si tu red no tiene IPv6 (error `P1001: Can't reach database server`), usa el **Session Pooler (IPv4)** en `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   ```
   El mismo string del pooler sirve para integraciones externas (ej. n8n).
4. **Seguridad:** `.env` contiene secretos — nunca lo subas al repo. Si una contraseña queda expuesta (chat, logs, commits), **rótala** en Supabase Dashboard → Database → Password y actualiza el `.env`.

---

### 8. Reserva transaccional TSK-BD-07 (Overbooking = 0)

- **Qué:** `src/repositories/availability.ts` expone `reserveDisponibilidad()` — reserva atómica con `SELECT ... FOR UPDATE`, ventana `[hoy, hoy+15]` en `America/Bogota` y `reserva` en `PENDIENTE_PAGO` (`expira_en = now + 15 min`).
- **Backend:** llamar siempre a `reserveDisponibilidad()` desde la API route; mapear con `isAvailabilityError(err) → err.httpStatus` (`404` not found, `409` sin cupo/bloqueada, `422` fuera de ventana, `400` cantidad inválida).
- **Frontend:** ante `409` mostrar "cupo agotado" y refrescar slots (no reintentar a ciegas); ante `422` "fuera de ventana 15 días"; con `201` iniciar checkout con countdown de `expiraEn`.
- **Regla de oro:** ningún código que ocupe cupos (`cupos_ocupados`) puede bypasear este repo. Detalle, ejemplos y auditoría: `src/repositories/README.md`.
