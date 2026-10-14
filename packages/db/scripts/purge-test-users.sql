-- ==============================================================================
-- Script de Purga de Cuentas Bot / Pruebas en Producción (SCRUM-208)
-- ==============================================================================
-- Limpieza segura de ~78 cuentas de prueba y sus relaciones en el orden correcto
-- de integridad referencial para evitar violaciones de ON DELETE RESTRICT (HU-21).
--
-- Uso:
--   psql "$DIRECT_URL" -f packages/db/scripts/purge-test-users.sql
-- ==============================================================================

BEGIN;

-- 1. Identificar IDs de usuarios de prueba
CREATE TEMP TABLE temp_test_users ON COMMIT DROP AS
SELECT id, correo
FROM "usuario"
WHERE correo ILIKE '%test%'
   OR correo ILIKE '%bot%'
   OR correo ILIKE '%example%'
   OR correo ILIKE '%mock%';

-- 2. Limpieza de tokens efímeros
DELETE FROM "token_verificacion"
WHERE usuario_id IN (SELECT id FROM temp_test_users);

-- 3. Desvincular referencias de empleados de prueba en tickets e inscripciones
UPDATE "ticket_qr"
SET usado_por = NULL
WHERE usado_por IN (SELECT id FROM temp_test_users);

UPDATE "inscripcion_torneo"
SET ticket_usado_por = NULL
WHERE ticket_usado_por IN (SELECT id FROM temp_test_users);

UPDATE "reserva"
SET vendedor_id = NULL
WHERE vendedor_id IN (SELECT id FROM temp_test_users);

-- 4. Limpieza de auditoría y accesos asociados a reservas de prueba
DELETE FROM "lectura_acceso"
WHERE empleado_id IN (SELECT id FROM temp_test_users)
   OR ticket_id IN (
       SELECT tq.id FROM "ticket_qr" tq
       JOIN "reserva" r ON r.id = tq.reserva_id
       WHERE r.titular_id IN (SELECT id FROM temp_test_users)
   );

DELETE FROM "asignacion_puesto"
WHERE empleado_id IN (SELECT id FROM temp_test_users);

DELETE FROM "ticket_qr"
WHERE reserva_id IN (
    SELECT id FROM "reserva"
    WHERE titular_id IN (SELECT id FROM temp_test_users)
);

-- 5. Inscripciones a torneos de prueba
DELETE FROM "inscripcion_torneo"
WHERE usuario_id IN (SELECT id FROM temp_test_users);

DELETE FROM "torneo_bloqueo"
WHERE torneo_id IN (
    SELECT id FROM "torneo"
    WHERE admin_id IN (SELECT id FROM temp_test_users)
);

DELETE FROM "torneo"
WHERE admin_id IN (SELECT id FROM temp_test_users);

-- 6. Reservas, pagos y membresías de prueba
DELETE FROM "reserva"
WHERE titular_id IN (SELECT id FROM temp_test_users);

DELETE FROM "pago"
WHERE usuario_id IN (SELECT id FROM temp_test_users);

DELETE FROM "membresia"
WHERE usuario_id IN (SELECT id FROM temp_test_users);

DELETE FROM "inhabilitacion_servicio"
WHERE admin_id IN (SELECT id FROM temp_test_users);

-- 7. Eliminación final de usuarios en tabla relacional
DELETE FROM "usuario"
WHERE id IN (SELECT id FROM temp_test_users);

COMMIT;
