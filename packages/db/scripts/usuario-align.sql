-- ============================================================================
-- Supabase — Alineación de la tabla `usuario` (Plan B, fase B4)
-- Ejecutar DESPUÉS de supabase-auth-audit.sql y de crear los usuarios en
-- Supabase Auth (fase B3).
--
-- IMPORTANTE:
--   * Hacer backup/snapshot antes (Supabase → Database → Backups, o pg_dump).
--   * Ejecutar dentro de una transacción y revisar el SELECT antes del COMMIT.
--   * `correo` tiene índice UNIQUE case-sensitive; normalizar a minúsculas
--     puede chocar si existe una variante duplicada (ver B2.4).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- B4.1 — Normalizar correos a minúsculas (evita fallos de enlace con Auth)
-- ---------------------------------------------------------------------------
UPDATE "usuario"
SET correo = lower(correo)
WHERE correo <> lower(correo);

-- ---------------------------------------------------------------------------
-- B4.2 — Reactivar cuentas con borrado lógico en los admins operativos
--        (solo si corresponde; ajustar la lista de correos)
-- ---------------------------------------------------------------------------
UPDATE "usuario"
SET deleted_at = NULL
WHERE lower(correo) IN ('admin@example.com', 'admin@sportcomplex.com')
  AND deleted_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- B4.3 — Forzar estado ACTIVO en los admins (para poder iniciar sesión)
-- ---------------------------------------------------------------------------
UPDATE "usuario"
SET estado = 'ACTIVO'
WHERE lower(correo) IN ('admin@example.com', 'admin@sportcomplex.com')
  AND estado <> 'ACTIVO';

-- ---------------------------------------------------------------------------
-- B4.4 — Asegurar rol ADMIN en los correos administradores
-- ---------------------------------------------------------------------------
UPDATE "usuario" u
SET rol_id = r.id
FROM "rol" r
WHERE r.nombre = 'ADMIN'
  AND lower(u.correo) IN ('admin@example.com', 'admin@sportcomplex.com')
  AND u.rol_id <> r.id;

-- ---------------------------------------------------------------------------
-- Verificación previa al COMMIT: revisar el resultado
-- ---------------------------------------------------------------------------
SELECT u.nombre, u.correo, u.estado, r.nombre AS rol, u.google_sub, u.deleted_at
FROM "usuario" u
LEFT JOIN "rol" r ON r.id = u.rol_id
WHERE lower(u.correo) IN ('admin@example.com', 'admin@sportcomplex.com')
ORDER BY u.correo;

-- Si el resultado es correcto:
COMMIT;
-- Si NO: ROLLBACK;
