# Onboarding — SportComplex

> Estado: vigente 2026-10-15

Productivo en 60 minutos. Monorepo `turbo + pnpm`, app `apps/web` (Next.js 16), dominio en `packages/*`, datos en Supabase/PostgreSQL.

## 0–5 min: qué es y en qué orden leer

Plataforma de complejo deportivo: reservas con ventana de 15 días y bloqueo TTL de 30 min, POS 100% cashless (Stripe), acceso por QR firmado, torneos, membresías con 30% de descuento, analítica y automatización n8n.

1. [`product/srs.md`](./product/srs.md) — qué hace el sistema (RF-00–RF-21, RNF-01–RNF-06, RN-01–RN-14).
2. [`architecture/architecture.md`](./architecture/architecture.md) — estructura, versiones congeladas, convenciones y ramas.
3. [`architecture/data-model.md`](./architecture/data-model.md) — MER/DER si vas a tocar datos.
4. [`features/`](./README.md) del dominio que te toque (reservas, pagos-pos, control-acceso…).

## 5–20 min: requisitos y primer arranque

Requisitos: node `22.14.0`, pnpm `12.6.0` (vía `corepack`), docker, turbo `2.11.4`.

```bash
corepack enable && corepack prepare pnpm@12.6.0 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Env: copia `apps/web/.env.example` → `apps/web/.env.local` y pide valores reales al equipo. n8n local sin dominios: [`infra/local-dev.md`](./infra/local-dev.md).

### Variables que sí o sí necesitas

| Grupo | Variables | Notas |
|---|---|---|
| Supabase | `DATABASE_URL` (pooler IPv4, app), `DIRECT_URL` (directa IPv6, migraciones — falla con `P1001` si tu red no tiene IPv6: usa el pooler), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor) | Proyecto dev ref `ouemmmwpygmizyvtcpuc`; prod `phyesjwtzrmrcvmtajay`. Nunca commitear secretos (ver [`infra/supabase-envs.md`](./infra/supabase-envs.md)) |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Solo claves `test` en local |
| OAuth | `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth |
| n8n | `N8N_WEBHOOK_BASE_URL` (`https://n8n.akros.lat` en prod), `N8N_AUTH_EMAIL_WEBHOOK_URL`, `N8N_CONTINGENCY_WEBHOOK_URL`, `N8N_CONTINGENCY_HMAC_SECRET` | Base única `n8n.akros.lat` |
| Cron/chatbot | `CRON_SECRET`, `BOT_API_KEY`, `QR_HMAC_SECRET`, `NAGER_DATE_BASE_URL` | TTL y festivos Colombia |

## 20–35 min: mapa del código y DAG

| Necesitas… | Vas a… |
|---|---|
| Regla de negocio (tarifas, ventanas, aforo) | `packages/core` (`domain/`, `services/`, `security/`, `integrations/`) |
| Tipos puros / casos de uso | `packages/domain`, `packages/application` |
| Esquema, migraciones, repositorios | `packages/db` (`prisma/`, `src/repositories/`, `src/jobs/`) |
| Contratos de API | `packages/validation` (`platform/`, `business/`) |
| UI compartida / utilidades | `packages/ui`, `packages/shared` |
| Pantallas por dominio | `packages/features/*` (booking, tournament, pos, scanner, portal, admin) |
| Endpoint | `apps/web/src/app/api/**/route.ts` (handlers delgados) |
| Correos/QR/reportes | n8n → `packages/automation/workflows/` |

DAG: `ui` ← `shared` ← `booking` ← `pos`; `tournament` ← `portal` (+`booking`). Sin imports relativos a `apps/web`: todo por `@sportcomplex/*`. Detalle en [`architecture/packages-features.md`](./architecture/packages-features.md).

## 35–50 min: comandos y verificación

```bash
pnpm dev                                   # todo en local
turbo run build --filter=web...            # build como CI
pnpm --filter web test                     # tests de un paquete
pnpm verificar:limites                     # 0 infracciones de fronteras
pnpm typecheck && pnpm lint && pnpm test   # gate antes del PR
```

Smoke: reserva un slot en `/portal/book`, paga con Stripe test, escanea el QR en `/scanner`, revisa el webhook en n8n. Zona horaria canónica `America/Bogota` — nunca `Date.now()` suelto para negocio, pasa por `packages/core`.

## 50–60 min: troubleshooting top-5

1. `P1001` en Prisma → tu red no tiene IPv6: usa `DATABASE_URL` del pooler (IPv4) para app y reserva `DIRECT_URL` para migraciones.
2. `pnpm install` falla → activa la versión exacta con `corepack prepare pnpm@12.6.0 --activate` y usa `--frozen-lockfile`.
3. Tipos Prisma ausentes tras tocar `schema.prisma` → `pnpm db:generate` antes de `typecheck`.
4. QR/webhook n8n no llega → revisa `N8N_WEBHOOK_BASE_URL` y que n8n local esté en `:5678` (ver `infra/local-dev.md`).
5. Tests de paquete fallan por paths → córrelos desde el dir del paquete, no desde la raíz.

## Checklist del primer PR

- [ ] Rama `feature/<kebab-descriptiva>` desde `develop` (`main` solo prod).
- [ ] Commits Conventional Commits (`feat:`, `fix:`, `docs:`…).
- [ ] Respuesta API canónica `{ success, data/error, timestamp }`.
- [ ] `typecheck + lint + test + verificar:limites` en verde.
- [ ] Sin secretos en el diff; docs del dominio actualizadas y link registrado en [`README.md`](./README.md).

## Anti-patrones (no repitas)

- Editar `.env` a mano en el VPS (rotan por secrets del environment `production`).
- Publicar puertos de contenedores en el host (salvo `80/443` en Caddy): usa `expose`.
- `localhost` entre contenedores: usa nombres de servicio Docker.
- Lógica de negocio en `apps/web` o queries fuera de `@sportcomplex/db`.
- Mocks o fallbacks silenciosos en producción.

## A quién preguntar

| Tema | Doc | A quién |
|---|---|---|
| Regla de negocio nueva | `features/*.md` del dominio | quien mantuvo esa feature |
| Despliegue / Caddy / Docker | `infra/README.md` | responsable de infra |
| Emails / webhooks / n8n | `automation/overview.md` | responsable de automatización |
| Datos / migraciones | `architecture/data-model.md` | responsable de datos |
