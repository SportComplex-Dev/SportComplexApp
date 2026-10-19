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
Guía paso a paso (de dónde obtener cada valor, reset de admin, troubleshooting): `docs/infra/env-setup.md`.
Infra local (n8n) sin dominios: ver [`docs/infra/local-dev.md`](./docs/infra/local-dev.md).

## Convenciones

- Ramas: `main` (prod VPS), `develop` (integración), `feature/*` según `docs/architecture/architecture.md §9.1`.
- Commits: Conventional Commits (`feat:`, `fix:`, ...).
- Archivos `kebab-case`, componentes `PascalCase`, esquemas `*.schema.ts`, APIs `route.ts`.
- Respuesta API canónica: `{ success: true, data, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`.
- Documentación: por tema en `docs/` (ver convenciones en [`docs/README.md`](./docs/README.md)).

## Despliegue VPS

* Producción en VPS dedicado, edge único con Caddy, imágenes en GHCR y deploy por GitHub Actions en `main`.
* Detalles:
  * Arquitectura de contenedores: [`docs/infra/docker.md`](./docs/infra/docker.md)
  * Proxy y dominios: [`docs/infra/caddy.md`](./docs/infra/caddy.md)
  * Pipeline (CI/CD, secrets, `.env` vía secrets): [`docs/infra/ci-cd.md`](./docs/infra/ci-cd.md)
  * Aprovisionamiento del VPS: [`docs/infra/vps-provisioning.md`](./docs/infra/vps-provisioning.md)

## Entornos Supabase

- `prod` (ref `phyesjwtzrmrcvmtajay`) y `develop` (`ouemmmwpygmizyvtcpuc`): credenciales solo en secrets del environment `production` / `.env` local, nunca en git.
- Backup cifrado: `pg_dump -Fc` + `openssl enc -aes-256-cbc -pbkdf2 -iter 100000`; custodiar el `.enc` y destruir el plano.
- Ventana domingos 02:00–04:00 COT; purga de usuarios de prueba con scripts `purge-test-users` (dry-run primero).
- Bootstrap prod idempotente con `SEED_ADMIN_PASSWORD` (soporta `--rotate-password`).
- Detalle completo: [docs/infra/supabase-envs.md](./docs/infra/supabase-envs.md).
