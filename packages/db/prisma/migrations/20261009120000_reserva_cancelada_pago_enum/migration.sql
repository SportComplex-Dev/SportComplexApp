-- TSK-BE-10 (HU-10 / RF-09): estado de reserva para pago fallido.
-- El webhook `payment_intent.payment_failed` cancela la reserva y restituye la
-- franja; se distingue de EXPIRADA (TTL) y CANCELADA_ADMINISTRATIVA (contingencia).
ALTER TYPE "EstadoReserva" ADD VALUE IF NOT EXISTS 'CANCELADA_PAGO';
