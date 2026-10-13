# Onboarding — SportComplex

Guía para que un dev nuevo sea productivo en el repo en menos de una hora.

## 1. Qué es esto (5 min)

Plataforma de gestión de un complejo deportivo: reservas con ventana de tiempo, POS cashless con Stripe, control de acceso por QR con torniquetes, torneos, membresías. Lee en este orden:

1. [`product/srs.md`](./product/srs.md) — qué hace el sistema (RF-00–RF-21, reglas RN-01–RN-14).
2. [`architecture/architecture.md`](./architecture/architecture.md) — estructura del monorepo, versiones fijadas, convenciones.

## 2. Levantar el entorno (15 min)

```bash
corepack enable && corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

- Copia `apps/web/.env.example` → `apps/web/.env.local` y pide al equipo los valores reales (Supabase, Stripe, Google OAuth).
- n8n local: [`infra/local-dev.md`](./infra/local-dev.md).
- Verificación: `pnpm typecheck`, `pnpm lint`, `pnpm test` deben pasar antes de tu primer commit.

## 3. Mapa mental del código

| Necesitas... | Vas a... |
|---|---|
| Tocar una regla de negocio (tarifas, ventanas, aforo) | `packages/core` (lógica pura, testeable) |
| Cambiar el esquema o migraciones | `packages/db` (Prisma + Supabase) |
| UI / componentes | `packages/ui` y `apps/web` |
| Contratos de API | `packages/validation` (Zod) |
| Un endpoint | `apps/web/src/app/api/**/route.ts` |
| Flujos de correo/QR/reportes | n8n → `packages/automation/workflows/` |

## 4. Flujo de trabajo

1. Rama desde `develop`: `feature/<kebab-descriptiva>`; lanza a `main` solo prod.
2. Commits: **Conventional Commits** (`feat:`, `fix:`, `docs:` ...).
3. Respuesta de API canónica: `{ success: true, data, timestamp }` / `{ success: false, error: { code, message, details? }, timestamp }`.
4. Zona horaria canónica: `America/Bogota`. Nunca uses `Date.now()` suelto para lógica de negocio — pasa por `packages/core`.
5. Al abrir PR corre `ci.yml` (typecheck + lint + test + build). Verde o no hay merge.
6. Merge a `main` = deploy automático al VPS (ver [`infra/ci-cd.md`](./infra/ci-cd.md)).

## 5. Dónde preguntar qué

| Tema | Doc | Humano |
|---|---|---|
| Reglas de negocio nuevas | revisa el `features/*.md` del dominio | quién mantuvo esa feature |
| Problemas de despliegue / Caddy / Docker | `infra/README.md` y los subdocs | responsable de infra |
| Emails, webhooks, n8n | `automation/overview.md` | responsable de automatización |

## 6. Anti-patrones conocidos (no repitas)

- No midificar `.env` a mano en el VPS: rota por GitHub Secrets (`APPS_WEB_ENV`).
- No publicar puertos de contenedores en el host (salvo `80/443` en Caddy): usar `expose`.
- No referenciar `localhost` entre contenedores: usar nombres de servicio de la red Docker.
