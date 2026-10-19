# Configuración del entorno local (`apps/web/.env.local`)

> **¿Por qué mi `git clone` no funciona?** Porque `.env.local` está en `.gitignore`
> (`.env.*`) y **a propósito no se versiona**: contiene credenciales. Git solo te trae la
> **plantilla vacía** `apps/web/.env.example`. Cada persona **rellena su propio** `.env.local`
> una vez, normalmente obteniendo los valores del panel de Supabase del equipo.
>
> Documento relacionado: `README.md` (§Desarrollo local), [`../features/auth.md`](../features/auth.md).

---

## 1. Quick start (TL;DR)

```bash
# 1. Copia la plantilla (una sola vez)
cp apps/web/.env.example apps/web/.env.local      # PowerShell: Copy-Item apps\web\.env.example apps\web\.env.local

# 2. Rellena los valores (ver §2–§5). Como mínimo, el bloque Supabase + Auth.

# 3. Instala y arranca
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

Si el login responde `401 "Credenciales incorrectas"`, el 90% de las veces es que falta
`AUTH_ALLOW_LOCAL_FALLBACK="true"` o las keys de Supabase son las equivocadas. Ver §7.

---

## 2. Supabase (obligatorio)

Proyecto compartido del equipo: **`phyesjwtzrmrcvmtajay`**.

### 2.1 URL y API keys

Panel → **Project Settings → API Keys** (y la sección **API** para la URL):

| Variable | Qué copiar del panel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Project URL** → `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | La **anon key** (JWT `eyJ...`) **o** la **publishable key** (`sb_publishable_...`) |
| `SUPABASE_SERVICE_ROLE_KEY` | La **service_role key** (JWT `eyJ...`) **o** la **secret key** (`sb_secret_...`). **Solo servidor; nunca la expongas.** |

> Nota: los formatos nuevos (`sb_publishable_` / `sb_secret_`) y los legacy (JWT `eyJ...`)
> son intercambiables. Si copias a mano, **cópialos del panel, no de un chat**, porque un
> carácter cambiado invalida la key y toda llamada de Auth devuelve 401.

### 2.2 Conexión a la base de datos (Prisma)

Panel → **Project Settings → Database → Connection string**. Usa el **Session pooler**
(el host directo `db.<ref>.supabase.co` es IPv6-only y suele no resolver en redes locales).

| Variable | Pooler | Notas |
|---|---|---|
| `DATABASE_URL` | Session pooler, puerto **5432** | Conexión de la app. Si usas Transaction pooler (`:6543`) añade `?pgbouncer=true`. |
| `DIRECT_URL` | Session pooler, puerto **5432** | Usada por Prisma para migraciones. |

- La contraseña debe ir **URL-encoded** (p. ej. `ñ` → `%C3%B1`, `@` → `%40`). Un espacio
  suelto o un carácter literal en la URL rompe la conexión.
- Formato: `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`

---

## 3. Autenticación (obligatorio)

| Variable | Cómo obtenerla |
|---|---|
| `AUTH_SECRET` | Genera una nueva: `openssl rand -base64 32` (o `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`). Debe ser **distinta por entorno**. |
| `AUTH_ALLOW_LOCAL_FALLBACK` | `"true"` en local mientras existan cuentas con `password_hash` sin identidad en Supabase Auth. Ver §5. |

### Google OAuth (opcional, solo si probarás "Continuar con Google")

| Variable | Cómo obtenerla |
|---|---|
| `AUTH_GOOGLE_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | El secret del mismo cliente OAuth |

El redirect autorizado en Google debe ser `http://localhost:3000/api/auth/callback/google`.

---

## 4. Resto de integraciones (opcionales por feature)

No bloquean el login ni el arranque; solo las features que las usan.

| Variable | Feature | Origen |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Enlaces/redirects | `http://localhost:3000` en local |
| `QR_HMAC_SECRET` | QR de tickets | Genera 64 hex: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | Pagos (sandbox) | Stripe Dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Webhook Stripe (confirma reservas y emite el pase) | Local: `stripe listen --forward-to localhost:3000/api/payments` imprime el `whsec_`. Producción: Dashboard (modo test) → Webhooks → `/api/payments` con `payment_intent.succeeded` y `payment_intent.payment_failed` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Pagos (cliente) | Stripe Dashboard → API keys |
| `NAGER_DATE_BASE_URL` | Festivos | Tiene default en código: `https://date.nager.at/api/v3` |
| `N8N_CONTINGENCY_WEBHOOK_URL` | Contingencia n8n | Instancia n8n del equipo |
| `N8N_CONTINGENCY_HMAC_SECRET` | Firma de contingencia | ≥32 chars aleatorios |
| `N8N_AUTH_EMAIL_WEBHOOK_URL` | Envío de código de verificación | Instancia n8n del equipo |
| `N8N_RESERVATION_QR_WEBHOOK_URL` | Correo del ticket con QR tras el pago (online y taquilla) | `https://n8n.akros.lat/webhook/reservas/despacho-qr` (workflow `despacho-correo-qr` activo) |
| `N8N_RESERVATION_QR_HMAC_SECRET` | Firma opcional del correo del ticket | ≥32 chars aleatorios (el workflow actual no la verifica) |
| `BOT_API_KEY` | API del bot (`/api/v1/bot/*`) | ≥32 chars aleatorios |
| `CRON_SECRET` | Job de expiración (`/api/cron/*`) | Secreto propio del job |
| `EXPIRE_BATCH_SIZE` | Tamaño de lote del job TTL | `500` por defecto |
| `RECEIPT_*` | Membrete del PDF de comprobante | Datos públicos del negocio |
| `TZ` | Zona horaria | `America/Bogota` |

---

## 5. Cuentas de staff y `password_hash` legacy

El login por correo/contraseña usa, en este orden:

1. **Supabase Auth** (`signInWithPassword`) — ruta primaria.
2. **Fallback local Argon2id** contra `usuario.password_hash` — **solo** si el correo **no**
   tiene identidad en Supabase **y** `AUTH_ALLOW_LOCAL_FALLBACK="true"` (`api/auth/route.ts`).

Por eso, en desarrollo, deja `AUTH_ALLOW_LOCAL_FALLBACK="true"` para que sigan entrando las
cuentas con `password_hash` que aún no se migraron a Supabase Auth. Cuando todas las cuentas
tengan identidad en Supabase, ponlo en `"false"` (ver [`../features/auth.md`](../features/auth.md)).

### Resetear la contraseña de una cuenta (admin)

Las contraseñas migradas son **aleatorias** y se guardan solo en la máquina que corrió la
migración (`packages/db/scripts/.auth-passwords.local.txt`, gitignored). Si nadie la conoce:

```bash
# Rota la contraseña de un admin existente (dirigido, seguro)
tsx packages/db/scripts/align-supabase-auth.mts --reset --only=admin@example.com

# Si el correo NO existe en Supabase Auth, créalo:
tsx packages/db/scripts/align-supabase-auth.mts --execute --only=admin@example.com
```

La nueva contraseña se escribe en `packages/db/scripts/.auth-passwords.local.txt`.

---

## 6. Verificación

```bash
# La BD responde y el esquema está aplicado
pnpm db:generate
pnpm --filter @sportcomplex/db exec prisma migrate status --schema prisma/schema.prisma

# El login responde (ajusta credenciales)
curl -i -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"password\":\"<tu-password>\"}"
# Éxito: HTTP 200 con { "success": true, "data": { "user": { "role": "Administrador", ... } } }
```

---

## 7. Troubleshooting

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| `401 Credenciales incorrectas` (cuenta válida) | Falta `AUTH_ALLOW_LOCAL_FALLBACK="true"`, o la anon/service key es incorrecta | Revisa §2 y §3; reinicia el dev server |
| `500` al iniciar sesión / "Error en la conexión a la base de datos" | `DATABASE_URL`/`DIRECT_URL` mal formadas (espacio, `ñ` sin encode, pooler equivocado) | Re-copia la connection string del Session pooler |
| Se queda en `/login` tras un 200 | Rol no resuelto por el middleware | Ver [`../features/auth.md`](../features/auth.md) |
| `422/401 Invalid API key` en logs del server | Key de Supabase corrupta o de otro proyecto | Re-copia desde el panel (no desde chat) |
| Cambié `.env.local` y no toma los cambios | Next.js cachea env al arrancar / `.next` viejo | Reinicia `pnpm dev`; si persiste, borra `apps/web/.next` |
| Consola: *"You may test your Stripe.js integration over HTTP. However, live Stripe.js integrations must use HTTPS."* | Aviso informativo de Stripe.js al cargarse sobre `http://` (incluido `http://localhost`) | No bloquea el pago en desarrollo: el flujo funciona igual con claves `test`. Desaparece con HTTPS (producción detrás de Caddy) |
| Pagué en Stripe pero la reserva sigue `PENDIENTE_PAGO` / el POS sigue esperando | El webhook no llega a `/api/payments` o su firma no coincide | Local: `stripe listen --forward-to localhost:3000/api/payments` y su `whsec_` en `STRIPE_WEBHOOK_SECRET` (reinicia `pnpm dev`). Producción: endpoint del dashboard (modo test) y su secreto en `APPS_WEB_ENV` |

> Regla de oro: **cambiar `.env.local` exige reiniciar el dev server.**

---

## 8. Seguridad

- **Nunca** versiones `.env.local` ni pegues su contenido en chats/tickets. Si un secreto se
  filtra, **rótalo** (`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `STRIPE_*`,
  `AUTH_GOOGLE_SECRET`, `QR_HMAC_SECRET`, `BOT_API_KEY`, contraseña de DB, etc.).
- `SUPABASE_SERVICE_ROLE_KEY` **bypasea RLS**: solo en servidor, jamás con prefijo `NEXT_PUBLIC_`.
- Usa secretos **distintos por entorno** (local/staging/producción) y no compartas los de producción.
