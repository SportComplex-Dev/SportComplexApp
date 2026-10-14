# SportComplex — Plataforma de Gestión de Reservas, Venta y Control de Acceso Deportivo

Monorepo gobernado por **Turborepo + pnpm workspaces**, app fullstack **Next.js 16 App Router** en `apps/web`,
lógica pura en `packages/core`, persistencia Prisma/Supabase en `packages/db`,
UI compartida en `packages/ui` y contratos Zod en `packages/validation`.

**Documentación**: ver [`docs/README.md`](./docs/README.md) — índice por tema.
Dev nuevo: empieza por [`docs/onboarding.md`](./docs/onboarding.md).
Documentos de referencia principales: [`docs/architecture/architecture.md`](./docs/architecture/architecture.md)
(estructura/versiones) y [`docs/product/srs.md`](./docs/product/srs.md) (RF/RNF/RN).

## Versiones congeladas (sin `^`/`~`)

| Capa | Paquete | Versión |
|------|---------|---------|
| Runtime | node | 22.14.0 |
| Monorepo | pnpm / turbo | 12.6.0 / 2.11.4 |
| Web | next / react / react-dom / typescript | 16.3.7 / 19.0.0 / 19.0.0 / 5.7.3 |
| Datos | prisma / @prisma/client / @supabase/supabase-js / @supabase/ssr | 7.10.0 / 7.10.0 / 2.49.1 / 0.5.2 |
| UI | tailwindcss | 4.3.3 |
| Contratos/utils | zod / stripe / qrcode / html5-qrcode / date-fns / date-fns-tz / ky | 4.6.5 / 22.6.2 / 1.5.4 / 2.3.8 / 4.1.0 / 3.2.0 / 1.7.5 |

Zona horaria canónica: `America/Bogota` (UTC-5).

## Estructura

```
apps/web          Next.js 16 App Router (app)
packages/core     dominio puro (reservas, tarifas, QR)
packages/db       Prisma + Supabase
packages/ui       componentes compartidos
packages/validation  contratos Zod
packages/config   configuración compartida
packages/automation  workflows n8n (JSON)
docker/           Dockerfile.web + compose + Caddyfile (producción)
docs/             documentación por tema (architecture, product, features, automation, infra)
```

## Desarrollo local

```bash
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Variables: copiar `apps/web/.env.example` a `apps/web/.env.local`.
Infra local (n8n) sin dominios: ver [`docs/infra/local-dev.md`](./docs/infra/local-dev.md).

## Convenciones

- Ramas: `main` (prod VPS), `develop` (integración), `feature/*` según `docs/architecture/architecture.md §9.1`.
- Commits: Conventional Commits (`feat:`, `fix:`, ...).
- Archivos `kebab-case`, componentes `PascalCase`, esquemas `*.schema.ts`, APIs `route.ts`.
- Respuesta API canónica: `{ success: true, data, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`.
- Documentación: por tema en `docs/` (ver convenciones en [`docs/README.md`](./docs/README.md)).

## Despliegue VPS

* Producción en VPS compartido, edge único con Caddy, imágenes en GHCR y deploy por GitHub Actions en `main`.
* Detalles:
  * Arquitectura de contenedores: [`docs/infra/docker.md`](./docs/infra/docker.md)
  * Proxy y dominios: [`docs/infra/caddy.md`](./docs/infra/caddy.md)
  * Pipeline (CI/CD, secrets, `.env` vía secrets): [`docs/infra/ci-cd.md`](./docs/infra/ci-cd.md)
  * Aprovisionamiento del VPS: [`docs/infra/vps-provisioning.md`](./docs/infra/vps-provisioning.md)

## Gestión de Entornos Supabase & Mantenimiento (SCRUM-208 / SCRUM-209)

### 1. Mapeo de Proyectos Supabase & Custodia de Credenciales
- **Producción (`prod`):**
  - Proyecto Supabase Ref: `phyesjwtzrmrcvmtajay`
  - Uso: Base de datos oficial de producción (clientes reales, reservas y transacciones).
  - Custodia: Las credenciales (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`) residen en GitHub Environment Secrets (`production`) y en el `.env` del VPS (modo `0600`).
- **Desarrollo (`develop`):**
  - Proyecto Supabase Ref: `ouemmmwpygmizyvtcpuc` (`SportComplex-Dev`)
  - Uso: Entorno aislado para integración y pruebas de desarrollo. Configurado en `packages/db/.env` o `apps/web/.env.local`.
  - Custodia: Claves restringidas a desarrolladores autorizados en el almacén de secretos del equipo.

### 2. Backup Cifrado de Producción
Antes de cualquier ventana de mantenimiento o purga, generar el volcado binario y cifrarlo con **AES-256-CBC** usando derivación de clave moderna (**PBKDF2** con 100,000 iteraciones):

```bash
# 1. Volcado binario (usar Session Pooler IPv4 si tu red no tiene IPv6):
pg_dump "postgresql://postgres:PASSWORD@db.phyesjwtzrmrcvmtajay.supabase.co:5432/postgres" -Fc -f backup_prod_prod.dump

# 2. Cifrado criptográfico con PBKDF2:
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -in backup_prod_prod.dump -out backup_prod_prod.dump.enc

# 3. Custodia y limpieza segura:
# Mover 'backup_prod_prod.dump.enc' al almacenamiento seguro fuera de línea (Cold Storage / Vault).
# Destruir inmediatamente el archivo sin cifrar:
shred -u backup_prod_prod.dump 2>/dev/null || rm -f backup_prod_prod.dump
```

### 3. Ventana de Mantenimiento y Purga de Datos de Prueba en Producción
- **Ventana Oficial:** Domingos de madrugada (02:00 – 04:00 COT / UTC-5), horario de tráfico mínimo.
- **Auditoría y Purga:** Para no violar las restricciones `ON DELETE RESTRICT` (HU-21) de usuarios con reservas/pagos asociados y para purgar simultáneamente las identidades en Supabase Auth (`auth.users`), utilizar los scripts dedicados:

```bash
# Opción A (Recomendada): Script TypeScript interactivo (PostgreSQL + Supabase Auth Admin API)
# Modo dry-run (solo lectura / auditoría):
pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.mts

# Modo ejecución:
pnpm --filter @sportcomplex/db exec tsx scripts/purge-test-users.mts --execute

# Opción B: Script SQL transaccional directo (PostgreSQL)
psql "$DIRECT_URL" -f packages/db/scripts/purge-test-users.sql
```

### 4. Bootstrap de Producción (`bootstrap:prod`)
Para inicializar producción de forma limpia y estrictamente idempotente (crea roles del sistema, planes oficiales de membresía y 1 cuenta de administrador inicial en Supabase Auth y en la tabla `usuario` con hash Argon2id):

```bash
# Ejecución estándar (requiere SEED_ADMIN_PASSWORD obligatoria):
SEED_ADMIN_PASSWORD="tu-contraseña-segura" pnpm bootstrap:prod

# Para rotar la contraseña de una cuenta de administrador existente:
SEED_ADMIN_PASSWORD="nueva-contraseña-segura" pnpm bootstrap:prod --rotate-password
```
