-- Migración 4.4: Restricciones CHECK para verificación e integridad
-- Contract: 20261015000003_agregar_restricciones_verificacion: CHECKs capacidad>0, tarifa>=0, descuento=30, precio>=0.

DO $$ BEGIN
  -- 1. Restricciones de Capacidad: capacidad > 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicio_capacidad_maxima_check') THEN
    ALTER TABLE "servicio" ADD CONSTRAINT "servicio_capacidad_maxima_check" CHECK (capacidad_maxima > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'torneo_cupos_totales_check') THEN
    ALTER TABLE "torneo" ADD CONSTRAINT "torneo_cupos_totales_check" CHECK (cupos_totales > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'disponibilidad_cupos_totales_check') THEN
    ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_cupos_totales_check" CHECK (cupos_totales > 0);
  END IF;

  -- 2. Restricciones de Tarifa: tarifa >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'servicio_tarifa_check') THEN
    ALTER TABLE "servicio" ADD CONSTRAINT "servicio_tarifa_check" CHECK (tarifa >= 0);
  END IF;

  -- 3. Restricciones de Descuento: descuento = 30.00 en plan_membresia
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_membresia_descuento_pct_check') THEN
    ALTER TABLE "plan_membresia" ADD CONSTRAINT "plan_membresia_descuento_pct_check" CHECK (descuento_pct = 30.00);
  END IF;

  -- 4. Restricciones de Precio / Monto: precio >= 0
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_membresia_precio_check') THEN
    ALTER TABLE "plan_membresia" ADD CONSTRAINT "plan_membresia_precio_check" CHECK (precio >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'torneo_precio_inscripcion_check') THEN
    ALTER TABLE "torneo" ADD CONSTRAINT "torneo_precio_inscripcion_check" CHECK (precio_inscripcion >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reserva_subtotal_check') THEN
    ALTER TABLE "reserva" ADD CONSTRAINT "reserva_subtotal_check" CHECK (subtotal >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reserva_total_check') THEN
    ALTER TABLE "reserva" ADD CONSTRAINT "reserva_total_check" CHECK (total >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pago_monto_check') THEN
    ALTER TABLE "pago" ADD CONSTRAINT "pago_monto_check" CHECK (monto >= 0);
  END IF;
END $$;
