# Plan de Auth — BACKEND

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
| **D3** | **(a)** — `password_hash` legacy; solo fallback local si Supabase no está configurado. | `app/api/auth/route.ts` |
| **D4** | **(b)** — Admin API con `email_confirm: true` al registrar y al verificar. | `lib/supabase/admin.ts`, `register/route.ts`, `verify/route.ts` |

Realizado:
- **Login** resuelve autorización desde `usuario`.rol/estado (`resolveAppUserByEmail` + `authGateFor`), ya no lee `user_metadata.role`; `PENDIENTE` → `ACCOUNT_PENDING` (frontend redirige a `/verify`).
- **Registro** crea la identidad en Supabase Auth (email confirmado) **y** la fila `usuario` en `PENDIENTE`, con rollback best-effort de la identidad si falla la fila DB y recuperación de huérfanos Auth.
- **Verify** confirma el email en Supabase al activar la cuenta (best-effort).
- **`POST /api/auth/logout`** agregado (`supabase.auth.signOut()`).
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
- Verificación de sesión Supabase en middleware: `apps/web/src/middleware.ts:21-51`.
- Mapeo Supabase → `usuario` (por correo, fallback): `apps/web/src/middleware.ts:205-224`
  y `apps/web/src/lib/api-auth.ts:86-139`.
- Extracción de cookies de sesión Supabase: `apps/web/src/lib/session.ts:91-140`.
- Autorización de APIs vía headers `x-sc-authenticated-*`: `apps/web/src/lib/api-auth.ts:63-75`.
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
   bloqueado (`apps/web/src/lib/route-access.ts:16`).
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
- Devolver `role = normalizeRole(user.rol.nombre)` (`apps/web/src/lib/session.ts:23`).
- Aplicar estado: `PENDIENTE` → `ACCOUNT_PENDING` (redirige a `/verify`); `!== 'ACTIVO'` o
  `deletedAt` → `ACCOUNT_INACTIVE`.
- La rama local con `password_hash` (`:55-83`): mantener solo como **fallback** cuando
  `isSupabaseAuthConfigured()` sea falso, o eliminar según D3.

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
- `apps/web/src/middleware.ts:205-224`: buscar primero por `supabaseUid`, luego por correo
  `insensitive`.
- `apps/web/src/lib/api-auth.ts:119-139`: misma estrategia.

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
- Cliente/Vendedor/Lector caen en su `ROLE_HOME` (`apps/web/src/lib/session.ts:12`).
- Los overrides de desarrollo (`?role=`, `sc-role`, `sc-session`) siguen inactivos en producción
  (`apps/web/src/middleware.ts:133-138`, `apps/web/src/lib/session.ts:232`).

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
  (`apps/web/src/app/(auth)/login/page.tsx` y `apps/web/src/components/auth-form.tsx`).
