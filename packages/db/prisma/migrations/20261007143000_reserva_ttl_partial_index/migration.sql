-- TSK-BD-08 (HU-09 / RF-08 / RN-04): Job de expiración del TTL de 15 minutos.
-- Índice parcial para localizar RESERVA en PENDIENTE_PAGO vencidas (expira_en < NOW()).
-- Prisma no expresa índices parciales de forma declarativa; vive en SQL raw
-- (mismo patrón que membresia_usuario_vigente_uniq en TSK-BD-11).
-- Reemplaza el índice genérico reserva_expira_en_idx por el parcial.

DROP INDEX IF EXISTS "reserva_expira_en_idx";

CREATE INDEX IF NOT EXISTS "reserva_expira_ttl_idx"
  ON "reserva"("expira_en")
  WHERE "estado" = 'PENDIENTE_PAGO';
