# Autenticación y cuentas
> Estado: vigente 2026-10-15

## Requisitos y persistencia

La SRS (`RF-01`) y la arquitectura (`§8.1`) establecen que una cuenta Google
queda activa inmediatamente. El esquema de `USUARIO` de `TSK-BD-06` ya incluye
`google_sub` único, `correo` único, `avatar_url`, `nombre`, `estado` y el rol.
Por eso esta tarea no requiere una migración.

El callback de Auth.js en `apps/web/src/auth.ts` persiste la identidad Google
antes de crear la sesión:

- Solo acepta perfiles Google con `email_verified = true`.
- Busca primero por `google_sub` y luego por correo, sin distinguir mayúsculas.
- Vincula el `google_sub` a la fila existente y actualiza nombre, correo, avatar
  y estado a `ACTIVO`; no cambia el rol existente.
- Crea un único usuario con rol `CLIENTE` cuando el correo/sub no existe.
- Rechaza correos ambiguos, sub ya asociado a otra cuenta, cuentas borradas
  lógicamente e inactivas.

La unicidad de `correo` y `google_sub` en PostgreSQL es la última defensa contra
duplicados concurrentes. El JWT de Auth.js guarda el id, rol y estado para que
el middleware autorice solo sesiones activas. La cookie de sesión es
`HttpOnly`, `SameSite=Lax` y `Secure` en producción; en desarrollo local HTTP
no se marca `Secure` para que el navegador pueda enviarla.

## Configuración local y Google Cloud

1. Configura `AUTH_SECRET` con un valor aleatorio propio (por ejemplo,
   `openssl rand -base64 32`) y completa `AUTH_GOOGLE_ID` y
   `AUTH_GOOGLE_SECRET` en `apps/web/.env.local`.
2. En Google Cloud Console, configura OAuth como aplicación web y añade el
   origen `http://localhost:3000` y el URI autorizado
   `http://localhost:3000/api/auth/callback/google`.
3. En producción, usa el dominio HTTPS real y su URI
   `https://<dominio>/api/auth/callback/google`; configura las variables
   correspondientes en el entorno de despliegue, no en el repositorio.
4. Inicia el frontend (`pnpm --filter web dev`) y prueba el botón “Continuar
   con Google”.

## Verificación del criterio de aceptación

Con un usuario de prueba ya existente con `correo = juan@example.com`:

1. Inicia sesión con la cuenta Google cuyo correo verificado sea
   `juan@example.com`.
2. Comprueba en la base de datos que siga existiendo una sola fila para ese
   correo, que `google_sub` tenga el subject de Google y que `estado = ACTIVO`.
3. Confirma que `rol_id` no cambió y que el navegador recibió la cookie de
   sesión `HttpOnly` (y `Secure` al probar en HTTPS).

La cuenta puede inspeccionarse sin exponer secretos:

```sql
SELECT id, correo, google_sub, nombre, avatar_url, estado, rol_id
FROM usuario
WHERE lower(correo) = lower('juan@example.com');
```
## Plan de Auth — BACKEND

> **Tipo:** Arreglo del flujo de autenticación existente (no es una user story nueva).
> **Objetivo:** que el login con **Supabase Auth** funcione de punta a punta, usando la tabla
> `usuario` de Supabase como fuente de rol/estado.
> **Dueño:** Backend. **Coordinación:** DB (ver §7).

---

## 0. Estado (2026-10-11) — decisiones tomadas e implementadas

| ID | Decisión | Implementación |
|----|----------|----------------|
| **D1** | **(b) mínimo** — Google sigue en NextAuth; Supabase queda para correo/contraseña. Unificar a (a) pendiente. | — |
| **D2** | **(b) por ahora** — enlace por correo normalizado (minúsculas; tabla ya alineada). Migración a `usuario.supabase_uid` (a) queda pendiente de coordinar con DB. | `lib/auth/resolve-app-user.ts` |
| **D3** | **(a)** — `password_hash` legacy; fallback local **estricto**: solo cuando el correo **no** tiene identidad en Supabase **y** `AUTH_ALLOW_LOCAL_FALLBACK=true` (fail-closed si la Admin API falla). | `app/api/auth/route.ts`, `lib/auth/auth-gate.ts` |
| **D4** | **(b)** — Admin API con `email_confirm: true` al registrar y al verificar. | `lib/supabase/admin.ts`, `register/route.ts`, `verify/route.ts` |

Realizado:
- **Login** resuelve autorización desde `usuario`.rol/estado (`resolveAppUserByEmail` + `authGateFor`), ya no lee `user_metadata.role`; `PENDIENTE` → `ACCOUNT_PENDING` (frontend redirige a `/verify`).
- **Registro** crea la identidad en Supabase Auth (email confirmado) **y** la fila `usuario` en `PENDIENTE`, con rollback best-effort de la identidad si falla la fila DB y recuperación de huérfanos Auth.
- **Verify** confirma el email en Supabase al activar la cuenta (best-effort).
- **`POST /api/auth/logout`** expira `sc-token`/`sc-session`/`sc-role`/`sc-status` + cookies de Auth.js y llama `supabase.auth.signOut()` (best-effort); está cableado en la UI (`app-provider.tsx`).
- Tests unitarios de `authGateFor` (`lib/auth/__tests__/auth-gate.test.ts`).

Pendiente (coordinación con DB): migración `usuario.supabase_uid` (si se decide D2=a), E2E en /login con las dos cuentas admin provisionadas, y evaluar D1 en sesión posterior.

---

## 1. Contexto y objetivo

El login por correo/contraseña hoy **rechaza siempre** con *"Credenciales incorrectas"*. La
integración con Supabase Auth **ya está implementada**, pero está incompleta. Este documento
describe qué arreglar y qué decisiones tomar.

Arquitectura objetivo:

| Capa | Responsable |
|------|-------------|
| **Autenticación (quién eres)** | Supabase Auth (`signInWithPassword`) |
| **Autorización (qué puedes)** | tabla `usuario` (`rol.nombre`, `estado`, `deleted_at`) |
| **Sesión** | cookies `sb-*-auth-token` (verificadas en middleware y APIs) |

---

## 2. Qué ya existe (no rehacer)

- Login con Supabase: `apps/web/src/app/api/auth/route.ts:27-33`.
- Cliente SSR de Supabase: `apps/web/src/lib/supabase/server.ts`.
- Verificación de sesión Supabase en middleware: `apps/web/src/proxy.ts:21-51`.
- Mapeo Supabase → `usuario` (por correo, fallback): `apps/web/src/proxy.ts:205-224`
  y `apps/web/src/lib/api/api-auth.ts:86-139`.
- Extracción de cookies de sesión Supabase: `apps/web/src/lib/auth/session.ts:91-140`.
- Autorización de APIs vía headers `x-sc-authenticated-*`: `apps/web/src/lib/api/api-auth.ts:63-75`.
- Flujo de registro + verificación por código de 6 dígitos: `apps/web/src/app/api/auth/register/route.ts`,
  `apps/web/src/app/api/auth/verify/route.ts`.
- Google vía NextAuth (paralelo): `apps/web/src/auth.ts`, `apps/web/src/auth.config.ts`,
  `apps/web/src/app/api/auth/[...nextauth]/route.ts`.

---

## 3. Causas raíz del fallo actual

1. **Los usuarios no existen en Supabase Auth.** Las cuentas se insertaron solo en la tabla
   `usuario`. `signInWithPassword` no las encuentra → *"Credenciales incorrectas"*.
2. **El registro no crea usuario en Supabase Auth.** `register/route.ts` solo crea la fila
   `usuario` con `password_hash`; quien se registra no podrá loguearse por Supabase.
3. **Rol tomado de `user_metadata`.** `auth/route.ts:36-39` usa `user_metadata.role`
   (default `Cliente`) en vez de `usuario.rol` → un admin puede ser redirigido a `/portal` y
   bloqueado (`apps/web/src/lib/auth/route-access.ts:16`).
4. **Enlace por correo frágil.** Sin columna que persista el UID de Supabase; `correo` es
   UNIQUE case-sensitive mientras Auth normaliza a minúsculas.
5. **`password_hash` legacy con bcrypt.** El verificador usa Argon2id
   (`packages/core/src/security/token.ts:73`); los hashes bcrypt nunca validaron.

---

## 4. Decisiones a tomar (BACKEND)

| ID | Decisión | Opciones | Recomendación | Impacto en DB |
|----|----------|----------|---------------|---------------|
| **D1** | Google OAuth | (a) unificar en Supabase Auth (provider Google); (b) dejar NextAuth en paralelo | **(a)** una sola sesión | Bajo |
| **D2** | Enlace Auth ↔ `usuario` | (a) columna `usuario.supabase_uid`; (b) solo por correo `insensitive` | **(a)** robusto | **Alto** (migración + backfill) |
| **D3** | `password_hash` | (a) legacy (no tocar); (b) eliminar columna; (c) fallback Argon2id | **(a)** legacy | **Alto** si (b)/(c) |
| **D4** | Confirmación de email de Supabase | (a) desactivar y usar flujo de 6 dígitos de la app; (b) Admin API con `email_confirm: true` | **(b)** al provisionar / registrar | Medio |

> D2 y D3 **deben comunicarse a DB** en cuanto se decidan (§7).

---

## 5. Pasos de implementación

### 5.1 Login — `apps/web/src/app/api/auth/route.ts`
- Mantener `signInWithPassword` como ruta primaria (`:27-33`).
- **Eliminar** el rol desde `user_metadata` (`:36-39`). Tras autenticar, resolver `usuario`
  por `supabaseUid` (si D2=a) o por `correo` `mode: 'insensitive'`, incluyendo `rol`.
- Devolver `role = normalizeRole(user.rol.nombre)` (`apps/web/src/lib/auth/session.ts:23`).
- Aplicar estado: `PENDIENTE` → `ACCOUNT_PENDING` (redirige a `/verify`); `!== 'ACTIVO'` o
  `deletedAt` → `ACCOUNT_INACTIVE`.
- La rama local con `password_hash` (`:55-83`): fallback **estricto** — si `isSupabaseAuthConfigured()` es verdadero, solo habilitarlo si `AUTH_ALLOW_LOCAL_FALLBACK=true` y el correo **no** existe en Supabase Auth; fallar cerrado ante errores de la Admin API. Cuando no esté configurado, solo fallback contra BD local (Argon2id).

### 5.2 Registro — `apps/web/src/app/api/auth/register/route.ts`
- Crear el usuario en **Supabase Auth** con la Admin API (`SUPABASE_SERVICE_ROLE_KEY`,
  `email_confirm: true` si D4=b) **y** la fila `usuario` en `estado: PENDIENTE`,
  guardando `supabaseUid` (si D2=a).
- Manejar `EMAIL_EXISTS` sin duplicar en ninguno de los dos lados.
- Mantener el envío del código de 6 dígitos (flujo propio de activación).

### 5.3 Verificación — `apps/web/src/app/api/auth/verify/route.ts`
- Al validar el código, marcar `estado: 'ACTIVO'` (ya lo hace `:147-150`).
- Confirmar consistencia con Supabase Auth (email confirmado).

### 5.4 Logout y resolución de sesión
- Añadir `POST /api/auth/logout` con `supabase.auth.signOut()`.
- Resolver el rol del usuario autenticado vía `supabase.auth.getUser()` + tabla `usuario`.

### 5.5 Enlace robusto (si D2=a)
- `apps/web/src/proxy.ts:205-224`: buscar primero por `supabaseUid`, luego por correo
  `insensitive`.
- `apps/web/src/lib/api/api-auth.ts:119-139`: misma estrategia.

### 5.6 Google (según D1)
- **(a) unificar:** mover Google a Supabase Auth y retirar NextAuth (`auth.ts`,
  `auth.config.ts`, `app/api/auth/[...nextauth]/route.ts`), ajustando middleware.
- **(b) mínimo:** dejar NextAuth para Google; Supabase solo para correo/contraseña.

### 5.7 Variables de entorno (producción)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (**solo servidor**)
- Redirect URLs configuradas en Supabase.
- Si Google sigue en NextAuth: `AUTH_SECRET`, `AUTH_URL`, `AUTH_GOOGLE_ID/SECRET`.

### 5.8 Tests (node:test, patrón `apps/web/src/lib/__tests__/session.test.ts`)
- Login Supabase OK → rol resuelto desde `usuario`.
- `PENDIENTE` → bloqueado/redirige a `/verify`.
- `INACTIVO` / `deletedAt` → bloqueado.
- Registro crea usuario en Auth **y** en `usuario`.
- Middleware autoriza `/admin/*` para rol `Administrador`.

---

## 6. Criterios de aceptación

- `pnpm --filter web lint && pnpm --filter web typecheck && pnpm --filter web test && pnpm --filter web build` en verde.
- `admin@example.com` y `admin@sportcomplex.com` entran por Supabase → cookie `sb-*-auth-token`
  → `/admin/dashboard` sin rebote; `/api/admin/*` autoriza.
- Un registro nuevo queda en Supabase Auth **y** en `usuario` (`PENDIENTE`), va a `/verify`, y
  tras verificar entra.
- Cliente/Vendedor/Lector caen en su `ROLE_HOME` (`apps/web/src/lib/auth/session.ts:12`).
- Los overrides de desarrollo (`?role=`, `sc-role`, `sc-session`) siguen inactivos en producción
  (`apps/web/src/proxy.ts:133-138`, `apps/web/src/lib/auth/session.ts:232`).

---

## 7. Coordinación con DB

**Ya entregado por DB (independiente del backend):**
- `packages/db/scripts/supabase-auth-audit.sql` — auditoría (solo lectura) de hashes, roles,
  correos y **huérfanos** Auth ↔ `usuario`.
- `packages/db/scripts/usuario-align.sql` — alineación de `usuario` (correos en minúsculas,
  admins `ACTIVO`, rol `ADMIN`).
- `packages/db/README.md` — nota corregida (Supabase Auth / `password_hash` legacy).

**Bloqueado por decisiones de backend:**
- **D2** → si se adopta `usuario.supabase_uid`, DB prepara migración Prisma + índice único +
  backfill por correo.
- **D3** → si se elimina o se rehashea `password_hash`, DB prepara la migración correspondiente.

**Contrato de datos:**

| Interfaz | Acordado |
|----------|----------|
| Autenticación | Supabase Auth (email confirmado) |
| Autorización | `usuario.rol.nombre` + `usuario.estado` + `usuario.deleted_at` |
| Enlace | `supabase_uid` (recomendado) o correo `insensitive` |
| Errores | `INVALID_CREDENTIALS` / `ACCOUNT_PENDING` / `ACCOUNT_INACTIVE` |

---

## 8. Riesgos

- **Confirm email** activo en Supabase bloquea `signInWithPassword` de usuarios no confirmados:
  usar Admin API con `email_confirm: true` (coordinar D4).
- **Doble sesión** (NextAuth + Supabase) si no se unifica Google (D1): puede causar
  inconsistencias en middleware. Preferir (a).
- Cambiar el login toca el camino crítico: actualizar **ambos** formularios
  (`apps/web/src/app/(auth)/login/page.tsx` y `@sportcomplex/ui`).
## Login — arreglo, validación y estado (RBAC + fallback local)

> Documento de cierre de la incidencia **"el login responde 200 pero el usuario se queda en `/login`"**
> y de la habilitación de las cuentas con `password_hash` legacy (Argon2id/bcrypt) mediante un
> **fallback local estricto** y la **migración de cuentas de staff a Supabase Auth**.
>
> Fecha: 2026-06 · Rama base: `develop` · Entorno validado: local (`http://localhost:3000`).

---

## 1. Resumen ejecutivo

- **Causa raíz principal:** el middleware resolvía el rol leyendo `row.rol?.[0]` **asumiendo un array**, pero PostgREST devuelve la relación embebida `usuario → rol` (many-to-one) como **objeto** (`{ nombre: "ADMIN" }`). El rol quedaba en `null` y el middleware redirigía **siempre** a `/login` (por eso el `POST /api/auth` daba 200 pero la navegación posterior no progresaba).
- **Se corrigió** la resolución del rol (acepta objeto y array).
- **Se implementó** un **fallback de autenticación local estricto** para cuentas con `password_hash` (Argon2id) que aún no tienen identidad en Supabase Auth, emitiendo un token de sesión propio firmado (`sc-token`).
- **Se corrigió** un fallo de empaquetado con **Turbopack + Argon2 nativo** (`@node-rs/argon2` no se externalizaba por un `import` dinámico con variable).
- **Se migraron las 4 cuentas de staff** a Supabase Auth (4/4 creadas).
- **Validación final:** matriz HTTP **34/34** + suites de test **154 pass / 1 skip** (web 56 · core 38 · db 60+1 skip) + lint y typecheck limpios.
- **Integración con `develop`:** durante el cierre, `develop` ya había mergeado el mismo **fix de rol** y su propio `logout` con tests (PRs #42/#43). Este PR se fusionó con `develop` resolviendo los conflictos: se conservó el `middleware` de `develop` (fetch robusto a Supabase REST) y se le suma el `sc-token` (`await extractSession`), más la lógica de identidad Supabase en el alta y el fallback estricto.

---

## 2. Qué movimos (archivos)

### 2.1 Añadidos

| Archivo | Qué hace |
|---|---|
| `apps/web/src/lib/auth/auth-gate.ts` | Guards de acceso: evalúa rol + estado de la cuenta (`ACTIVO`, bloqueo por `ACCOUNT_PENDING`/`ACCOUNT_INACTIVE`, respeta borrado lógico). |
| `apps/web/src/lib/auth/resolve-app-user.ts` | Resuelve el usuario de aplicación (perfil `usuario` + rol) a partir del principal de Supabase, buscando por **correo case-insensitive** (`mode: "insensitive"`). |
| `apps/web/src/lib/auth/__tests__/auth-gate.test.ts` | Tests de los guards (estados, borrado lógico, roles). |
| `apps/web/src/lib/supabase/admin.ts` | Cliente admin (service role) con `findSupabaseUserByEmail` y `createSupabaseAuthUser` para la migración/alta de identidades. |
| `apps/web/src/app/api/auth/logout/route.ts` | Endpoint de cierre de sesión (limpia sesión Supabase y cookies propias). |
| `packages/db/scripts/align-supabase-auth.mts` | Script de migración **idempotente** de cuentas con `password_hash` hacia Supabase Auth. Dry-run por defecto; `--execute` (crea identidades con contraseña aleatoria por usuario), `--reset` (rota contraseñas; exige `--only=` o `--yes`) y filtro `--only=email1,email2`. Solo las credenciales aplicadas se escriben en `.auth-passwords.local.txt` (gitignored, 0600). |
| `packages/db/scripts/supabase-auth-audit.sql` | Consulta de auditoría de `password_hash` (por estado y tipo de hash). |
| `packages/db/scripts/usuario-align.sql` | Utilidad SQL de alineación de usuarios. |
| `docs/features/auth.md` | Plan de trabajo del backend de autenticación. |

### 2.2 Modificados

| Archivo | Cambio clave |
|---|---|
| `apps/web/src/proxy.ts` | **Fix del rol** vía `normalizeEmbeddedRole` (acepta objeto y array). Fetch robusto a Supabase REST con `.ilike("correo", …)` (email case-insensitive). Resolución de la sesión con `await extractSession(req)` (ya no solo dev). Redirección por `ROLE_HOME`. |
| `apps/web/src/lib/auth/session.ts` | `signScSessionToken` / `verifyScSessionToken` (HMAC-SHA256 con `AUTH_SECRET`, Web Crypto, TTL 24h, formato `payload.sig`). `extractSession` pasa a ser **async** y **verifica la firma** del `sc-token`. |
| `apps/web/src/app/api/auth/route.ts` | `buildLegacySession(email, password)`: fallback **estricto** (solo si el correo **no** existe en Supabase Auth), valida Argon2id vía `verifySecret`, aplica `authGateFor` y emite la cookie `sc-token` (`HttpOnly; SameSite=Lax; Max-Age=86400`). |
| `apps/web/src/app/api/auth/register/route.ts` | Ajustes del alta para no duplicar identidades y respetar el nuevo flujo. |
| `apps/web/src/app/api/auth/verify/route.ts` | Bloqueo de cuentas `PENDIENTE` (`ACCOUNT_PENDING`). |
| `apps/web/src/app/(auth)/login/page.tsx` | Tras login, redirige por rol (`roleHome[role]`) en vez de quedarse en la pantalla. |
| `packages/core/src/security/token.ts` | `getArgon2()` usa `import("@node-rs/argon2")` con specifier **literal** (Turbopack lo externaliza). `verifySecret`/`hashSecret` = Argon2id. |
| `packages/core/src/index.ts` | Se retira `export * from "./security/token"` del barril (evita arrastrar el binario nativo al bundle de cliente). |
| `packages/db/README.md`, `pnpm-lock.yaml` | Documentación y lockfile. |

---

## 3. Antes vs. Ahora

| Aspecto | Antes | Ahora |
|---|---|---|
| Resolución del rol | `row.rol?.[0]` (asumía array) → `null` → **redirect a `/login`** siempre | `normalizeEmbeddedRole` (objeto y array) → rol correcto |
| Resultado del login | `POST /api/auth` = 200 pero la UI **no avanzaba** | 200 + redirección al home del rol (`/admin/dashboard`, `/pos`, `/scanner`, `/portal`) |
| Cuentas con `password_hash` | No podían iniciar sesión (Argon2id real no validaba / flujo inexistente) | Login por **fallback local estricto** si no hay identidad Supabase |
| Token de sesión propio | `sc-session`/`sc-role` **solo en dev**, sin firma | `sc-token` firmado con `AUTH_SECRET` (HMAC-SHA256), verificado en middleware, funciona también en producción |
| Sesión del middleware | `extractSession` **síncrona**, sin verificar integridad | `extractSession` **async** que valida la firma del token |
| Argon2 en runtime | `import(arg) dinamico` no externalizado → error `Cannot find package '@node-rs/argon2'` en Turbopack | `import("@node-rs/argon2")` literal + `serverExternalPackages` |
| Cuentas de staff | Sin identidad en Supabase Auth | 4/4 migradas (vendedor, lector, laura, carlos) |
| Login de cuenta inexistente / pass incorrecta | sin criterio claro | **401** explícito |
| Acceso anónimo a ruta protegida | — | **307 → `/login`** |
| Acceso cross-role (p.ej. vendedor → `/admin`) | — | **403** |

---

## 4. Errores descubiertos y arreglados

1. **Rol siempre `null` (array vs objeto de PostgREST).** El embebido many-to-one llega como objeto; `row.rol?.[0]` devolvía `undefined`. → *Fix:* helper `normalizeEmbeddedRole` (objeto **y** array) + test de regresión. **Efecto:** era la causa del "se queda en `/login`".
2. **`@node-rs/argon2` no cargaba en Turbopack.** El `import` dinámico con specifier en variable no se externalizaba y el binario nativo no se resolvía en `.next/dev/server/chunks/[turbopack]_runtime.js`. → *Fix:* specifier **literal** + `serverExternalPackages: ["@node-rs/argon2"]` + sacar `security/token` del barril (entraba al bundle de cliente vía stores).
3. **Doble sistema de hash (Argon2id vs bcrypt).** `verifySecret` es Argon2id; los 56 hashes bcrypt **nunca** validan. → *Decisión:* no perpetuar el sistema dual; migrar a Supabase Auth y usar el fallback solo como puente para las Argon2id restantes.
4. **Cuentas `PENDIENTE` y borrado lógico.** Faltaba bloquear explícitamente estos casos. → *Fix:* `auth-gate.ts` (`ACCOUNT_PENDING` / `ACCOUNT_INACTIVE`, respeta borrado lógico).

---

## 5. Validación (evidencia)

**Matriz HTTP (34/34):**

| Escenario | Resultado |
|---|---|
| Login 9 cuentas (4 admin/cliente Supabase + 4 staff migradas + 1 fallback) | **200**, rol correcto, home correcto |
| Home por rol (`/admin/dashboard`, `/pos`, `/scanner`, `/portal`) | **200** |
| Contraseña incorrecta | **401** |
| Cuenta inexistente | **401** |
| Ruta protegida sin sesión | **307 → `/login`** |
| Cross-role (vendedor → `/admin/dashboard`) | **403** |

**Suites de test / estáticos:**

| Comprobación | Resultado |
|---|---|
| `apps/web` tests | **56 / 56** ✅ |
| `packages/core` tests | **38 / 38** ✅ |
| `packages/db` tests | **60 pass / 1 skip** ✅ |
| Lint (`web`) | **0 errores** ✅ |
| Typecheck `web` / `core` / `db` | **0 errores** ✅ |

---

## 6. Cosas a tener en cuenta

- **`.env.local` NO se versiona** (`.gitignore`: `.env`, `.env.*`). Contiene `AUTH_SECRET`, keys de Supabase y `DATABASE_URL`/`DIRECT_URL`. Cada entorno debe definirlas.
- **Cambiar `.env.local` exige reiniciar el dev server.** Si aparecen **404 en `/api/auth/*`**, borrar `apps/web/.next` y reiniciar (caché de Turbopack).
- **`AUTH_ALLOW_LOCAL_FALLBACK="true"`** habilita el fallback local. Si se pone en `false`, las cuentas con `password_hash` **sin** identidad Supabase dejan de poder entrar. Ponerlo en `false` una vez migradas todas.
- **Pooler IPv4 obligatorio:** `db.<ref>.supabase.co` es IPv6-only en este entorno; usar el Session Pooler (`aws-0-us-west-2.pooler.supabase.com:5432`).
- **hash legacy bcrypt (56 filas) no es recuperable** sin reset de contraseña: `verifySecret` es Argon2id.
- **Pendientes de migración:** 56 cuentas `CLIENTE` (y 56 bcrypt) siguen dependiendo del fallback local.
- **No existe columna `supabase_uid`** en `usuario` (solo `googleSub`); la resolución del usuario de aplicación se hace **por correo** (case-insensitive, tanto en Prisma como en el middleware vía `.ilike`), por eso provisionar identidades basta (sin cambio de esquema).
- **Seguridad:** las contraseñas de la sección 7 son **credenciales de prueba**. No reutilizar en producción ni versionar credenciales reales.

---

## 7. Usuarios de prueba

> Las contraseñas **no se versionan**. Son aleatorias por usuario (CSPRNG),
> generadas durante la migración y guardadas en
> `packages/db/scripts/.auth-passwords.local.txt` (gitignored, modo 0600) solo
> para las cuentas creadas/rotadas en cada ejecución. Cámbialas antes de
> cualquier entorno real.

### 7.1 Cuentas a las que se (re)asignó contraseña

| Correo | Rol | Home |
|---|---|---|
| `test@example.com` | Cliente | `/portal` |
| `admin@example.com` | Administrador | `/admin/dashboard` |
| `cliente@sportcomplex.com` | Cliente | `/portal` |
| `admin@sportcomplex.com` | Administrador | `/admin/dashboard` |

### 7.2 Cuentas de staff migradas a Supabase Auth

| Correo | Rol | Home |
|---|---|---|
| `vendedor@example.com` | Empleado_Vendedor | `/pos` |
| `lector@example.com` | Empleado_Lector | `/scanner` |
| `laura.taquilla@sportcomplex.com` | Empleado_Vendedor | `/pos` |
| `carlos.lector@sportcomplex.com` | Empleado_Lector | `/scanner` |

---

## 8. Próximos pasos

1. Migrar (o resetear) las **56 cuentas `CLIENTE`** restantes a Supabase Auth.
2. Cuando no queden cuentas con `password_hash` activas → `AUTH_ALLOW_LOCAL_FALLBACK="false"`.
3. Endurecer: rotación de `AUTH_SECRET`, expiración/refresh del `sc-token` y rate limiting en `/api/auth`.
## HU-21.DB — Restricciones de integridad y reglas de borrado para empleados

> Ref histórica: Backend · Responsable: Ingeniería de Datos y Backend · Fecha de implementación: 2026-10-09
> Alcance: restricciones de integridad en `packages/db` y controles de acceso/baja lógica en API.

## 1. Qué se hizo y por qué

El sistema transiciona a **baja lógica** (`Usuario.estado = INACTIVO` / `deleted_at`), pero en los
Route Handlers persisten operaciones de **borrado físico** (`DELETE`). Si la base de datos tuviera
reglas `CASCADE`, un borrado por error arrastraría ventas y escaneos, destruyendo historial
financiero y de auditoría. La base de datos debe ser la **última línea de defensa**: rechazar el
`DELETE` a nivel de motor con error de llave foránea.

Auditoría previa (hallazgo clave): el esquema **ya estaba blindado de facto** — la migración
`20260930132534_init_sport_complex` genera `ON DELETE RESTRICT` en todas las FKs hacia `usuario`
de negocio. Lo que faltaba era hacerlo **explícito, entregable y regresionable**:

| # | Cambio | Por qué | Archivo |
|---|--------|---------|---------|
| 1 | `onUpdate: Cascade` explícito en las 9 relaciones hacia `Usuario` (antes implícito por default de Prisma) + comentarios `HU-21.DB` | CA-03 auditable a simple vista; el SQL generado no cambia, pero el contrato queda declarado | `packages/db/prisma/schema.prisma` |
| 2 | Comentario de excepción en `TokenVerificacion.usuario` (mantiene `onDelete: Cascade`) | Token efímero de auth, no historial; purga de tokens debe seguir funcionando. Decisión acordada, fuera del alcance de CA-02 | mismo archivo |
| 3 | Migración `20261009000000_hu21_restrict_borrado_empleado/migration.sql` idempotente (`DROP CONSTRAINT IF EXISTS` + `ADD ... ON DELETE RESTRICT ON UPDATE CASCADE`, 9 FKs) | CA-04: entregable controlado vía pipeline, sin tocar Staging/Production a mano | `packages/db/prisma/migrations/...` |
| 4 | Test de regresión `test/hu21-empleado-integridad.test.ts` (4 casos, estático, sin DB) | Certifica CA-01/02/03/04 en cada CI: schema + SQL auditados automáticamente | `packages/db/test/...` |

Mapeo HU → esquema real (no existen modelos literales `Empleado/Venta/Escaneo`):

| HU | Esquema real |
|----|--------------|
| Empleado | `Usuario` (baja lógica vía `estado` + `deleted_at`) |
| Venta | `Pago` (`usuario_id`) + `Reserva` (`vendedor_id`) |
| Escaneo | `LecturaAcceso` (`empleado_id`) + `TicketQr` (`usado_por`) + `AsignacionPuesto` (`empleado_id`) |
| Otros historiales del empleado | `Reserva` (`titular_id`), `Membresia` (`usuario_id`), `InhabilitacionServicio` (`admin_id`) |

## 2. Requerimientos que cumple el esquema (evidencia)

- **CA-01 Rechazo de borrado activo.** Las 9 FKs son `ON DELETE RESTRICT`:
  `pago_usuario_id_fkey`, `reserva_titular_id_fkey`, `reserva_vendedor_id_fkey`,
  `ticket_qr_usado_por_fkey`, `asignacion_puesto_empleado_id_fkey`,
  `lectura_acceso_empleado_id_fkey`, `membresia_usuario_id_fkey`,
  `inhabilitacion_servicio_admin_id_fkey` (+ `usuario_rol_id_fkey` reafirmada).
  Un `DELETE FROM usuario` con historial aborta con `foreign_key_violation` (P2003 en Prisma).
  Evidencia: `migration.sql` de la HU + test `CA-01/CA-04`.
- **CA-02 Erradicación de cascadas y nulos.** `rg "onDelete: (Cascade|SetNull)" schema.prisma`
  solo devuelve: la excepción documentada `TokenVerificacion` (línea 148),
  `FranjaHoraria→Servicio` (no involucra a usuario) y `SetNull` en FKs que **no referencian**
  a `usuario` (`pago.membresia_id`, `reserva.pago_id/membresia_id/inhabilitacion_id`,
  `lectura_acceso.asignacion_id`). Evidencia: tests `CA-02` y `CA-02-excepción`.
- **CA-03 Preservación de actualizaciones.** Las 8 relaciones protegidas declaran
  `onUpdate: Cascade` explícito; updates de IDs fluyen a tablas hijas, solo el delete se bloquea.
  Evidencia: test `CA-03`.
- **CA-04 Entregable controlado e idempotente.** Migración versionada con patrón
  `DROP IF EXISTS` + `ADD`, re-ejecutable sin pérdida de datos; **no se ejecutó nada manual**
  en la DB compartida. Evidencia: test `CA-01/CA-04` (idempotencia) + este documento.

## 3. Integración Backend — TSK-BE-21

La tarea Backend complementa este blindaje con:

- RBAC actualizado en `proxy.ts`, consultando el rol y estado actuales
  de la cuenta en DB para que una baja surta efecto en la siguiente solicitud.
- Autorización repetida dentro de los Route Handlers protegidos; no se confía
  únicamente en el proxy.
- `PATCH /api/admin/employees/:id` con `{ "estado": "INACTIVO" }`. Solo un
  Administrador puede dar de baja cuentas Vendedor/Lector. La operación actualiza
  `estado` y `deleted_at`, no ejecuta `DELETE`, y es idempotente.
- Ventas, tickets, lecturas de acceso y demás relaciones se conservan; las FKs
  `ON DELETE RESTRICT` de esta migración siguen siendo la última barrera.

## 4. Verificación (cómo reproducir)

```bash
## Desde packages/db
npx prisma validate --schema prisma/schema.prisma   # schema válido
npx tsx --test test/hu21-empleado-integridad.test.ts # 4/4 pass
npm test        # 54/54 pass (suite completa)
npm run typecheck  # limpio
## CA-02 manual: rg "onDelete:" prisma/schema.prisma (ver tabla §2)
```

## 5. Notas de despliegue (leer antes del merge)

- **No se aplicó `migrate dev` a la DB compartida a propósito** (CA-04): el intento detectó
  *drift* — la DB remota (Supabase) no tiene aplicadas las migraciones
  `add_avatar_url_to_usuario`, `membresia_vigente_uniq`, `disponibilidad_unique_constraint` y
  `reserva_ttl_partial_index` (índices renombrados + columna `avatar` faltante). Prisma pidió
  `migrate reset` (borrar datos) y se abortó. La migración HU-21 se generó como artefacto
  controlado sin tocar datos.
- **Antes del deploy**, el pipeline (`prisma migrate deploy`) aplicará las 4 migraciones
  pendientes + esta. Si el entorno diverge en nombres de índices, revisar el drift reportado.
- En la tarea DB quedaron fuera los controladores API y la revocación de sesión;
  se incorporan en la sección 3 por TSK-BE-21. La baja lógica (`estado → INACTIVO`)
  es la vía oficial y el motor rechaza borrados físicos con historial.


---

## TSK-FE-21: Administración de Empleados y Roles Operativos

## 1. Identificación y Alcance
- **Ticket Jira:** TSK-FE-21 / SCRUM-141 (Historia de Usuario HU-21 / Requerimiento RF-18 / RN-10)
- **Módulo:** Panel de Administración (`/admin/employees`)
- **Objetivo:** Gestión integral de personal interno (roles `ADMIN`, `VENDEDOR`, `LECTOR`), alta con credenciales seguras vía Argon2id y sincronización con Supabase Auth (`auth.users`), y baja lógica con revocación inmediata de accesos preservando historial transaccional e integridad referencial (`RESTRICT`).

---

## 2. Arquitectura de Componentes (Modularización ARC-01)
El panel monolítico original fue refactorizado en subcomponentes especializados bajo `packages/features/admin/src/components/staff/`:

1. **`AdminEmployeesPage` (`apps/web/src/app/(admin)/admin/employees/page.tsx`):**
   - Controlador de estado y orquestador principal.
   - Manejo de estados de carga, error con reintento explícito (cero fallbacks silenciosos a mocks, `SEC-01`), y filtros reactivos en tiempo real por búsqueda y roles.
2. **`EmployeeStats` (`employee-stats.tsx`):**
   - Métricas de plantilla: Total colaboradores, Activos, Inactivos (bajas lógicas) y desglose de personal de campo (Vendedores / Lectores).
3. **`EmployeeTable` (`employee-table.tsx`):**
   - Tabla reactiva con ordenamiento, badges semánticos por rol (`formatRoleBadge`), badges de estado (`ACTIVO` vs `INACTIVO`), y botón de acción condicional para baja lógica.
   - Oculta o inhabilita acciones de baja para cuentas con rol Administrador o sesión propia.
4. **`EmployeeCreateModal` (`employee-create-modal.tsx`):**
   - Modal accesible de alta con validación de nombre, correo, rol y contraseña temporal.
   - Prevención de doble submit con indicador `Loader2`.
5. **`EmployeeDeactivateModal` (`employee-deactivate-modal.tsx`):**
   - Diálogo de confirmación accesible con advertencia de la regla de negocio `RN-10` (integridad de cobros y canjes).

---

## 3. Seguridad y Backend
- **Hashing Argon2id (`RNF-02`):**
  - Creado mediante `hashSecret()` (`@sportcomplex/core/src/security/token`) con parámetros de seguridad reforzados (memoryCost: 19456 KiB, timeCost: 2, parallelism: 1).
  - Nunca se retorna `password_hash` en ninguna respuesta JSON ni vista de cliente.
- **Sincronización con Supabase Auth (`SEC-04`):**
  - El endpoint `POST /api/admin/employees` verifica `isSupabaseAdminConfigured()`. Si está habilitado, da de alta el usuario en `auth.users` mediante `supabaseAdmin.auth.admin.createUser`, asegurando que el nuevo colaborador pueda autenticarse inmediatamente tanto por Supabase como por fallback local.
- **Baja Lógica e Integridad (`RN-10` / `CA-01`):**
  - La desactivación marca `estado = 'INACTIVO'` y establece `deletedAt = NOW()`.
  - La base de datos mantiene cláusula `ON DELETE RESTRICT` impidiendo que un colaborador que haya cobrado en taquilla o canjeado tickets sea eliminado físicamente.
- **Paginación en Repositorio (`PERF-01`):**
  - `listEmployees({ limit, offset, page })` aplica `take` y `skip` para evitar lecturas masivas no acotadas.

---

## 4. Pruebas y Validación
- Validación de esquemas con Zod (`createEmployeeSchema`).
- Pruebas unitarias de repositorio en `packages/db/src/repositories/employees.test.ts`.
- Pruebas de integración frontend en `apps/web/src/app/(admin)/admin/employees/__tests__/employees-ui.test.ts`.

## Trazabilidad

> Ref histórica: HU-21 (RF-18 / RN-10) · SCRUM-141 · ramas de auth (OAuth, verificación, empleados y roles)
> Recuperación y restablecimiento de contraseñas: ver [recuperacion-contrasena.md](./recuperacion-contrasena.md) (TSK-FE-33 / HU-38 / RF-01)
