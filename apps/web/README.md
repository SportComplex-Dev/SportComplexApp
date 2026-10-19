# App web (`apps/web`)

> Estado: vigente 2026-10-15

## Qué es

Next.js 16 App Router: coordina UI (`ui` + `features-*`), valida con `validation`, persiste vía `db`, responde `ok`/`fail`. Landing SSG + zonas por rol + API delgada + `proxy.ts` RBAC.

## Estructura / Exports

```
src/app/(public)/        # landing force-static (LCP < 1.5 s), catálogo
src/app/(auth)/          # login, register, verify
src/app/(customer)/      # portal cliente
src/app/(staff)/         # pos, scanner
src/app/(admin)/         # admin
src/app/api/*/route.ts   # 40 routes delgadas (auth, bookings, payments, access, admin, pos, memberships, tournaments, cron, webhooks, pdf, holidays, internal, v1/bot)
src/proxy.ts             # RBAC perimetral + 307 por rol + 401/403 API
src/lib/, src/components/, src/types/, src/styles/
```

Alias `@/* → src/*`; imports cruzados solo por `@sportcomplex/*` hacia `dist`.

## Cómo usar

```bash
cp apps/web/.env.example apps/web/.env.local  # llenar valores dev
pnpm dev
pnpm --filter web build
```

Env (`.env.local`): `DATABASE_URL` (pooler) + `DIRECT_URL` (migraciones), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo servidor), `QR_HMAC_SECRET`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `N8N_*`, `BOT_API_KEY`, `TZ=America/Bogota`, `CRON_SECRET`, `INTERNAL_API_KEY`, `AUTH_SECRET`, `AUTH_GOOGLE_*`, `AUTH_ALLOW_LOCAL_FALLBACK=false` en prod.

Rutas: `(public)` estática; `(auth|customer|staff|admin)` protegidas por `proxy.ts` (Cliente→`/portal`, Vendedor→`/pos`, Lector→`/scanner`, Admin→`/admin`). Routes: auth→Zod→repo→`ok`/`fail`, nunca lógica pesada.

> **Nota sobre Stripe.js en desarrollo local:** La advertencia en consola *"You may test your Stripe.js integration over HTTP. However, live Stripe.js integrations must use HTTPS."* es emitida por el script de Stripe en entornos locales bajo HTTP sin certificado. Es un comportamiento esperado que no bloquea los pagos en desarrollo y que desaparece en producción gracias a la terminación SSL/TLS de Caddy.

## Límites (No hacer)

- No importar `../../packages/*/src` (solo `@sportcomplex/*` → `dist`).
- No poner lógica de negocio en `route.ts` (delegar a `db`/`core`/`application`).
- No exponer `SUPABASE_SERVICE_ROLE_KEY` al cliente; no usar `avatar_url` en TS (usar `avatar` con `@map`).

## Testing

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Tests web desde `apps/web` (paths `@db-test/*` solo resuelven ahí). 261 tests. Dark mode + LCP: verificar landing estática y tokens `--brand`.

## Ref docs

- `docs/architecture/architecture.md`, `docs/api/rest.md`, `docs/features/auth.md`, `docs/infra/local-dev.md`
