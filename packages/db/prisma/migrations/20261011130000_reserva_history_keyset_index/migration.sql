-- TSK-BE-13 (#27): índice compuesto para el historial de reservas por keyset.
-- getBookingHistory filtra por (titular_id, estado) y ordena por
-- (creado_en DESC, id DESC). El índice anterior (titular_id, estado) no cubría
-- la clave de orden, forzando un sort. Se reemplaza por el compuesto, que cubre
-- el prefijo de igualdad y el orden de la paginación.

DROP INDEX IF EXISTS "reserva_titular_id_estado_idx";

CREATE INDEX IF NOT EXISTS "reserva_titular_id_estado_creado_en_id_idx"
  ON "reserva"("titular_id", "estado", "creado_en", "id");
