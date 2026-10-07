-- TSK-BD-11 (HU-20 / RF-16): Persistencia de membresías y catálogo de planes
-- 1) Convención snake_case: renombrar "fechaInicio" -> "fecha_inicio"
ALTER TABLE "membresia" RENAME COLUMN "fechaInicio" TO "fecha_inicio";

-- 2) Criterio de aceptación clave: una persona no puede tener dos membresías VIGENTES.
-- Índice único parcial a nivel motor.
CREATE UNIQUE INDEX IF NOT EXISTS "membresia_usuario_vigente_uniq"
  ON "membresia"("usuario_id")
  WHERE "estado" = 'VIGENTE';

-- 3) Hardening: descuento fijo 30% para planes (RN-08).
-- Prisma no expresa CHECK de forma declarativa; se impone en SQL.
-- Normalizar dato legacy previo al CHECK (id=1 VIP Mensual con 15.00).
UPDATE "plan_membresia" SET "descuento_pct" = 30.00 WHERE "descuento_pct" <> 30.00;

ALTER TABLE "plan_membresia"
  ADD CONSTRAINT "plan_membresia_descuento_pct_check"
  CHECK (descuento_pct = 30.00);
