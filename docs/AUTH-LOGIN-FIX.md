# Login — arreglo, validación y estado (RBAC + fallback local)

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
| `docs/PLAN-AUTH-BACKEND.md` | Plan de trabajo del backend de autenticación. |

### 2.2 Modificados

| Archivo | Cambio clave |
|---|---|
| `apps/web/src/middleware.ts` | **Fix del rol** vía `normalizeEmbeddedRole` (acepta objeto y array). Fetch robusto a Supabase REST con `.ilike("correo", …)` (email case-insensitive). Resolución de la sesión con `await extractSession(req)` (ya no solo dev). Redirección por `ROLE_HOME`. |
| `apps/web/src/lib/session.ts` | `signScSessionToken` / `verifyScSessionToken` (HMAC-SHA256 con `AUTH_SECRET`, Web Crypto, TTL 24h, formato `payload.sig`). `extractSession` pasa a ser **async** y **verifica la firma** del `sc-token`. |
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
