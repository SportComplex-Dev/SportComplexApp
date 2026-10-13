-- ============================================================================
-- Supabase Auth — Auditoría (solo lectura)
-- Plan B, fases B2 y B5. NO modifica datos.
--
-- Cómo ejecutar (Supabase → SQL Editor, o psql con la Session Pooler IPv4):
--   psql "$DIRECT_URL" -f packages/db/scripts/supabase-auth-audit.sql
-- Requiere acceso al esquema auth (rol postgres / service role).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- B2.1 — Algoritmo de hash actual de password_hash (evidencia del bug bcrypt)
-- ---------------------------------------------------------------------------
SELECT
  correo,
  estado,
  CASE
    WHEN password_hash IS NULL            THEN 'NULL'
    WHEN password_hash LIKE '$argon2id$%' THEN 'argon2id'
    WHEN password_hash LIKE '$2a$%'       THEN 'bcrypt'
    WHEN password_hash LIKE '$2b$%'       THEN 'bcrypt'
    WHEN password_hash LIKE '$2y$%'       THEN 'bcrypt'
    ELSE 'otro'
  END AS algoritmo
FROM "usuario"
ORDER BY "creado_en" DESC;

-- ---------------------------------------------------------------------------
-- B2.2 — Usuarios de la app con rol, estado y borrado lógico
-- ---------------------------------------------------------------------------
SELECT
  u.id,
  u.nombre,
  u.correo,
  lower(u.correo) AS correo_norm,
  u.estado,
  r.nombre        AS rol,
  u.google_sub,
  u.deleted_at,
  u."creado_en"
FROM "usuario" u
LEFT JOIN "rol" r ON r.id = u.rol_id
ORDER BY u."creado_en" DESC;

-- ---------------------------------------------------------------------------
-- B2.3 — Correos que NO están en minúsculas (rompen el enlace con Auth)
-- ---------------------------------------------------------------------------
SELECT correo
FROM "usuario"
WHERE correo <> lower(correo);

-- ---------------------------------------------------------------------------
-- B2.4 — Posibles duplicados de correo ignorando mayúsculas (el UNIQUE es
--         case-sensitive, Supabase Auth normaliza a minúsculas)
-- ---------------------------------------------------------------------------
SELECT lower(correo) AS correo_norm, count(*) AS ocurrencias, array_agg(correo) AS variantes
FROM "usuario"
GROUP BY lower(correo)
HAVING count(*) > 1;

-- ---------------------------------------------------------------------------
-- B5.1 — Filas en `usuario` que NO tienen cuenta en Supabase Auth
--        (estas no pueden iniciar sesión por signInWithPassword)
-- ---------------------------------------------------------------------------
SELECT u.correo, u.estado, r.nombre AS rol
FROM "usuario" u
LEFT JOIN "rol" r ON r.id = u.rol_id
LEFT JOIN auth.users a ON lower(a.email) = lower(u.correo)
WHERE a.id IS NULL
ORDER BY u."creado_en" DESC;

-- ---------------------------------------------------------------------------
-- B5.2 — Cuentas de Supabase Auth SIN fila en `usuario`
--        (existen en Auth pero el middleware no les encontrará rol/estado)
-- ---------------------------------------------------------------------------
SELECT a.id, a.email, a.email_confirmed_at, a.created_at
FROM auth.users a
LEFT JOIN "usuario" u ON lower(u.correo) = lower(a.email)
WHERE u.id IS NULL
ORDER BY a.created_at DESC;

-- ---------------------------------------------------------------------------
-- B5.3 — Estado de confirmación de email y proveedores en Supabase Auth
--        (email confirmado = requisito para signInWithPassword)
-- ---------------------------------------------------------------------------
SELECT
  id,
  email,
  email_confirmed_at,
  (email_confirmed_at IS NOT NULL) AS email_confirmado,
  raw_app_meta_data->>'provider'   AS provider,
  last_sign_in_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;
