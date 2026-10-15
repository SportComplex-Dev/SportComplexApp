-- Migración 4.3: Agregar actualizado_en a Inscripción Torneo + Trigger
-- Contract: 20261015000002_agregar_actualizado_en_a_inscripcion: actualizado_en TIMESTAMPTZ DEFAULT now() + trigger.

ALTER TABLE "inscripcion_torneo" ADD COLUMN IF NOT EXISTS "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION actualizar_marca_tiempo_inscripcion_torneo()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_actualizar_inscripcion_torneo ON "inscripcion_torneo";
CREATE TRIGGER trigger_actualizar_inscripcion_torneo
BEFORE UPDATE ON "inscripcion_torneo"
FOR EACH ROW
EXECUTE FUNCTION actualizar_marca_tiempo_inscripcion_torneo();
