-- TSK-BD-12: Módulo de Torneos, Bloqueos de Pistas e Inscripciones

-- 1. Agregar nuevo valor al enum TipoPago
ALTER TYPE "TipoPago" ADD VALUE IF NOT EXISTS 'TORNEO';

-- 2. Crear nuevos enums para Torneos e Inscripciones
DO $$ BEGIN
  CREATE TYPE "EstadoTorneo" AS ENUM ('BORRADOR', 'INSCRIPCIONES_ABIERTAS', 'EN_CURSO', 'FINALIZADO', 'CANCELADO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EstadoInscripcionTorneo" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADA', 'CANCELADA');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Crear tabla "torneo"
CREATE TABLE IF NOT EXISTS "torneo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "descripcion" TEXT,
    "nivel" VARCHAR(60) NOT NULL,
    "fecha_inicio" TIMESTAMPTZ NOT NULL,
    "fecha_fin" TIMESTAMPTZ NOT NULL,
    "cupos_totales" INTEGER NOT NULL,
    "cupos_ocupados" INTEGER NOT NULL DEFAULT 0,
    "precio_inscripcion" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "estado" "EstadoTorneo" NOT NULL DEFAULT 'BORRADOR',
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "torneo_pkey" PRIMARY KEY ("id")
);

-- 4. Crear tabla "torneo_bloqueo"
CREATE TABLE IF NOT EXISTS "torneo_bloqueo" (
    "id" SERIAL NOT NULL,
    "torneo_id" UUID NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "hora_inicio" TIMESTAMPTZ NOT NULL,
    "hora_fin" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "torneo_bloqueo_pkey" PRIMARY KEY ("id")
);

-- 5. Crear tabla "inscripcion_torneo"
CREATE TABLE IF NOT EXISTS "inscripcion_torneo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "torneo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "pago_id" UUID,
    "estado" "EstadoInscripcionTorneo" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "nombre_pareja" VARCHAR(120),
    "ticket_codigo_uuid" UUID DEFAULT gen_random_uuid(),
    "ticket_estado" "EstadoTicket" NOT NULL DEFAULT 'EMITIDO',
    "ticket_usado_en" TIMESTAMPTZ,
    "ticket_usado_por" UUID,
    "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscripcion_torneo_pkey" PRIMARY KEY ("id")
);

-- 6. Índices y constraints únicas
CREATE INDEX IF NOT EXISTS "torneo_fecha_inicio_estado_idx" ON "torneo"("fecha_inicio", "estado");
CREATE INDEX IF NOT EXISTS "torneo_bloqueo_servicio_id_hora_inicio_hora_fin_idx" ON "torneo_bloqueo"("servicio_id", "hora_inicio", "hora_fin");
CREATE UNIQUE INDEX IF NOT EXISTS "inscripcion_torneo_torneo_id_usuario_id_key" ON "inscripcion_torneo"("torneo_id", "usuario_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inscripcion_torneo_ticket_codigo_uuid_key" ON "inscripcion_torneo"("ticket_codigo_uuid");
CREATE INDEX IF NOT EXISTS "inscripcion_torneo_usuario_id_estado_idx" ON "inscripcion_torneo"("usuario_id", "estado");

-- 7. Claves Foráneas
ALTER TABLE "torneo" DROP CONSTRAINT IF EXISTS "torneo_admin_id_fkey";
ALTER TABLE "torneo" ADD CONSTRAINT "torneo_admin_id_fkey"
    FOREIGN KEY ("admin_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "torneo" DROP CONSTRAINT IF EXISTS "torneo_categoria_id_fkey";
ALTER TABLE "torneo" ADD CONSTRAINT "torneo_categoria_id_fkey"
    FOREIGN KEY ("categoria_id") REFERENCES "categoria_servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "torneo_bloqueo" DROP CONSTRAINT IF EXISTS "torneo_bloqueo_torneo_id_fkey";
ALTER TABLE "torneo_bloqueo" ADD CONSTRAINT "torneo_bloqueo_torneo_id_fkey"
    FOREIGN KEY ("torneo_id") REFERENCES "torneo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "torneo_bloqueo" DROP CONSTRAINT IF EXISTS "torneo_bloqueo_servicio_id_fkey";
ALTER TABLE "torneo_bloqueo" ADD CONSTRAINT "torneo_bloqueo_servicio_id_fkey"
    FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inscripcion_torneo" DROP CONSTRAINT IF EXISTS "inscripcion_torneo_torneo_id_fkey";
ALTER TABLE "inscripcion_torneo" ADD CONSTRAINT "inscripcion_torneo_torneo_id_fkey"
    FOREIGN KEY ("torneo_id") REFERENCES "torneo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inscripcion_torneo" DROP CONSTRAINT IF EXISTS "inscripcion_torneo_usuario_id_fkey";
ALTER TABLE "inscripcion_torneo" ADD CONSTRAINT "inscripcion_torneo_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inscripcion_torneo" DROP CONSTRAINT IF EXISTS "inscripcion_torneo_pago_id_fkey";
ALTER TABLE "inscripcion_torneo" ADD CONSTRAINT "inscripcion_torneo_pago_id_fkey"
    FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inscripcion_torneo" DROP CONSTRAINT IF EXISTS "inscripcion_torneo_ticket_usado_por_fkey";
ALTER TABLE "inscripcion_torneo" ADD CONSTRAINT "inscripcion_torneo_ticket_usado_por_fkey"
    FOREIGN KEY ("ticket_usado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
