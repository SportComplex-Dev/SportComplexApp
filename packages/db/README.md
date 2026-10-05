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
