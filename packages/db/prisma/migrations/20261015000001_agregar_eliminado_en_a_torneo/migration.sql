-- Migración 4.2: Agregar eliminado_en (soft delete) a Torneo
-- Contract: 20261015000001_agregar_eliminado_en_a_torneo: deleted_at TIMESTAMPTZ + índice.
-- Prisma: eliminadoEn DateTime? @map("deleted_at"). Repos filtran eliminadoEn: null.

ALTER TABLE "torneo" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "torneo_deleted_at_idx" ON "torneo"("deleted_at");
