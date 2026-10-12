# SportComplex — Plataforma de Gestión de Reservas, Venta y Control de Acceso Deportivo

Monorepo gobernado por **Turborepo + pnpm workspaces**, app fullstack **Next.js 16 App Router** en `apps/web`,
lógica pura en `packages/core`, persistencia Prisma/Supabase en `packages/db`,
UI compartida en `packages/ui` y contratos Zod en `packages/validation`.

Documentos de referencia: `docs/ARCHITECTURE.md` (prevalece en estructura/versiones),
`docs/SRS-sportComplex(2).md` (RF-00–RF-21, RNF-01–RNF-06, RN-01–RN-14).

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

Ver `docs/ARCHITECTURE.md §5` — árbol `sport-complex/` (apps/web, packages/core|db|ui|validation|config, docker/, .github/).

## Desarrollo local

```bash
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Variables: copiar `apps/web/.env.example` a `apps/web/.env.local`.

## Convenciones

- Ramas: `main` (prod VPS), `develop` (integración), `feature/*` según ARCHITECTURE §9.1.
- Commits: Conventional Commits (`feat:`, `fix:`, ...).
- Archivos `kebab-case`, componentes `PascalCase`, esquemas `*.schema.ts`, APIs `route.ts`.
- Respuesta API canónica: `{ success: true, data, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`.

## Despliegue VPS

`docker/docker-compose.yml` + `docker/Dockerfile.web` (multi-stage, `output: 'standalone'`) + Caddy (SSL auto).
Migraciones como init-container (`prisma migrate deploy`) antes de levantar `web`.
