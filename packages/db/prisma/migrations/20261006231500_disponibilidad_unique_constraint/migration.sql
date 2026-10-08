-- TSK-BE-04: Constraint único en disponibilidad por (servicio_id, franja_id, fecha) y sincronización de secuencia

-- 1. Limpieza preventiva de duplicados preexistentes (si los hubiera)
DELETE FROM "disponibilidad" d1
WHERE EXISTS (
  SELECT 1 FROM "disponibilidad" d2
  WHERE d2.servicio_id = d1.servicio_id
    AND d2.franja_id = d1.franja_id
    AND d2.fecha = d1.fecha
    AND d2.id < d1.id
);

-- 2. Garantizar que el constraint UNIQUE exista a nivel tabla en information_schema.table_constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'disponibilidad'
      AND constraint_name = 'disponibilidad_servicio_id_franja_id_fecha_key'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'disponibilidad'
        AND indexname = 'disponibilidad_servicio_id_franja_id_fecha_key'
    ) THEN
      ALTER TABLE "disponibilidad"
        ADD CONSTRAINT "disponibilidad_servicio_id_franja_id_fecha_key"
        UNIQUE USING INDEX "disponibilidad_servicio_id_franja_id_fecha_key";
    ELSE
      ALTER TABLE "disponibilidad"
        ADD CONSTRAINT "disponibilidad_servicio_id_franja_id_fecha_key"
        UNIQUE ("servicio_id", "franja_id", "fecha");
    END IF;
  END IF;
END $$;

-- 3. Sincronizar la secuencia de disponibilidad para evitar colisiones P2002 en disponibilidad_pkey
SELECT setval(
  pg_get_serial_sequence('disponibilidad', 'id'),
  COALESCE((SELECT MAX(id) FROM "disponibilidad"), 1)
);
