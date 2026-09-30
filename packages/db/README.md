# Módulo de Base de Datos (`packages/db`)

Este paquete centraliza la gestión de la base de datos utilizando **Prisma ORM** y **PostgreSQL** para todo el sistema SportComplex / SportCenter.

---

## 🛠️ Lo que se ha implementado en este módulo

1. **Definición del Esquema (`prisma/schema.prisma`)**:
   - Modelado relacional completo con **16 tablas** y enums de dominio robustos (Estados de usuario, categorías de servicio, modalidades de reserva, pagos, membresías, control de accesos, etc.).
2. **Configuración de Prisma & Cliente**:
   - Configuración centralizada mediante `prisma.config.ts` y exportación de instancias optimizadas de `PrismaClient` en `src/client.ts`.
3. **Migraciones y Control de Versiones**:
   - Migración inicial (`init_sport_complex`) estructurada para desplegar la estructura base en PostgreSQL.
4. **Repositorios de Datos**:
   - Estructura modular para lógica de acceso a datos (ej. repositorios de reservas en `src/repositories/bookings.ts`).

---

## 📋 Guía de Uso e Indicaciones para el Equipo

### 1. Variables de Entorno (`.env`)
Crea un archivo `.env` dentro de `packages/db/` basado en la siguiente estructura:

```env
DATABASE_URL="postgresql://usuario:contraseña@host-pooler:5432/nombre_db"
DIRECT_URL="postgresql://usuario:contraseña@host-directo:5432/nombre_db"
```

---

### 2. Importante: Uso de `DATABASE_URL` (Pooler / Base URL) vs `DIRECT_URL`

Al configurar tu conexión a PostgreSQL (especialmente en proveedores como Supabase, Neon o RDS), notarás que existen dos URLs distintas. **Es obligatorio seguir estas pautas de uso:**

#### 🚀 Usar `DATABASE_URL` para la Aplicación y Consultas (Runtime)
- **Qué es:** Es la URL que conecta a través de un **Connection Pooler** (ej. Supabase Pooler en modo Transaction o Session).
- **Por qué usarla en lugar de la conexión directa:**
  1. **Control de Conexiones Concurrentes:** Las aplicaciones modernas generan múltiples solicitudes y conexiones simultáneas. Si cada instancia o consulta abre una conexión directa al servidor de base de datos, se agotará rápidamente el límite máximo de conexiones permitidas por PostgreSQL, arrojando errores críticos de `too many connections`.
  2. **Reutilización y Rendimiento:** El Pooler gestiona una reserva (pool) de conexiones activas y las reutiliza eficientemente entre las peticiones de los usuarios, mejorando la latencia y la estabilidad del servidor.
  3. **Escalabilidad:** Es indispensable para arquitecturas serverless o contenedores distribuidos donde el número de clientes fluctuantes puede dispararse.

#### ⚙️ Usar `DIRECT_URL` Exclusivamente para Migraciones e Introspección
- **Qué es:** Es la conexión directa y sin intermediarios al servidor de base de datos principal.
- **Cuándo usarla:** Solo se debe configurar en `prisma.config.ts` o comandos CLI para ejecutar operaciones DDL y migraciones de esquema (`prisma migrate dev` o `prisma migrate deploy`).
- **Por qué no usarla en la app:** Las migraciones de base de datos requieren bloqueos de esquema, transacciones preparadas y características a nivel de sesión que los connection poolers (en modo transacción) pueden rechazar o corromper. Por ello, Prisma separa el canal de migración (`directUrl`) del canal de consultas de la aplicación (`url`).

---

### 3. Comandos Principales

Ejecuta estos comandos desde la raíz del proyecto o filtrando por paquete:

- **Generar cliente de Prisma:**
  ```bash
  pnpm --filter @sportcomplex/db db:generate
  ```
- **Crear y aplicar nueva migración (en desarrollo):**
  ```bash
  pnpm --filter @sportcomplex/db db:migrate
  ```
- **Desplegar migraciones en producción:**
  ```bash
  pnpm --filter @sportcomplex/db db:migrate:deploy
  ```
- **Abrir Prisma Studio (Interfaz visual de BD):**
  ```bash
  pnpm --filter @sportcomplex/db db:studio
  ```
