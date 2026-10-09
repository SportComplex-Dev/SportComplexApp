-- HU-21.DB — Restricciones de integridad y reglas de borrado para empleados (usuarios).
--
-- Contexto: el sistema transiciona a baja lógica (estado INACTIVO / deleted_at) pero persisten
-- operaciones de borrado físico en Route Handlers. Esta migración blinda el motor como última
-- línea de defensa: cualquier DELETE físico de un usuario con historial es abortado por la FK.
--
-- Mapeo HU -> esquema real: Empleado = usuario; Venta = pago + reserva (vendedor_id);
-- Escaneo = lectura_acceso + ticket_qr.usado_por + asignacion_puesto.
--
-- La explicitación de `onUpdate: Cascade` en schema.prisma no altera el comportamiento ya
-- vigente (el SQL histórico ya era ON UPDATE CASCADE); por eso esta migración REAFIRMA de
-- forma idempotente las 9 FKs usuario -> negocio con ON DELETE RESTRICT ON UPDATE CASCADE.
-- Es segura y re-ejecutable: cada bloque hace DROP IF EXISTS antes del ADD.
--
-- Excepción documentada (CA-02): token_verificacion.usuario_id se mantiene
-- ON DELETE CASCADE (token efímero de auth, no historial financiero/auditoría).
-- Los ON DELETE SET NULL restantes (pago.membresia_id, reserva.pago_id/membresia_id/
-- inhabilitacion_id, lectura_acceso.asignacion_id) no referencian a usuario: fuera de alcance.

-- 1. pago.usuario_id (historial financiero)
ALTER TABLE "pago" DROP CONSTRAINT IF EXISTS "pago_usuario_id_fkey";
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. reserva.titular_id (historial comercial)
ALTER TABLE "reserva" DROP CONSTRAINT IF EXISTS "reserva_titular_id_fkey";
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_titular_id_fkey"
  FOREIGN KEY ("titular_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. reserva.vendedor_id (historial de ventas del empleado)
ALTER TABLE "reserva" DROP CONSTRAINT IF EXISTS "reserva_vendedor_id_fkey";
ALTER TABLE "reserva" ADD CONSTRAINT "reserva_vendedor_id_fkey"
  FOREIGN KEY ("vendedor_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. ticket_qr.usado_por (auditoría de escaneos)
ALTER TABLE "ticket_qr" DROP CONSTRAINT IF EXISTS "ticket_qr_usado_por_fkey";
ALTER TABLE "ticket_qr" ADD CONSTRAINT "ticket_qr_usado_por_fkey"
  FOREIGN KEY ("usado_por") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. asignacion_puesto.empleado_id (turnos del empleado)
ALTER TABLE "asignacion_puesto" DROP CONSTRAINT IF EXISTS "asignacion_puesto_empleado_id_fkey";
ALTER TABLE "asignacion_puesto" ADD CONSTRAINT "asignacion_puesto_empleado_id_fkey"
  FOREIGN KEY ("empleado_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. lectura_acceso.empleado_id (historial de auditoría de escaneos)
ALTER TABLE "lectura_acceso" DROP CONSTRAINT IF EXISTS "lectura_acceso_empleado_id_fkey";
ALTER TABLE "lectura_acceso" ADD CONSTRAINT "lectura_acceso_empleado_id_fkey"
  FOREIGN KEY ("empleado_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. membresia.usuario_id (historial de membresías)
ALTER TABLE "membresia" DROP CONSTRAINT IF EXISTS "membresia_usuario_id_fkey";
ALTER TABLE "membresia" ADD CONSTRAINT "membresia_usuario_id_fkey"
  FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. inhabilitacion_servicio.admin_id (auditoría administrativa)
ALTER TABLE "inhabilitacion_servicio" DROP CONSTRAINT IF EXISTS "inhabilitacion_servicio_admin_id_fkey";
ALTER TABLE "inhabilitacion_servicio" ADD CONSTRAINT "inhabilitacion_servicio_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "usuario"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. usuario.rol_id (coherencia con explicitación onUpdate; ya era RESTRICT/CASCADE)
ALTER TABLE "usuario" DROP CONSTRAINT IF EXISTS "usuario_rol_id_fkey";
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey"
  FOREIGN KEY ("rol_id") REFERENCES "rol"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
