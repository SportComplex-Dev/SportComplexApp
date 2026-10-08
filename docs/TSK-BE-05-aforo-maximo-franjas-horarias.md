# TSK-BE-05 — Aforo máximo y generación de franjas horarias

> Historia: HU-05 (RF-04) · Fase F1 · Backend
> Dependencia: TSK-BE-04

## Alcance implementado

- La creación de servicios valida en backend que `capacidadMaxima` sea un entero mayor que cero.
- La generación de disponibilidades asigna `cuposTotales = capacidadMaxima` para modalidad `AFORO` y `cuposTotales = 1` para modalidad `EXCLUSIVA`.
- La generación cubre desde el día actual hasta el final de la ventana configurada (15 días por defecto), creando disponibilidades solo para las franjas cuyo `diaSemana` coincide con cada fecha.
- La generación es idempotente por la clave `(servicioId, franjaId, fecha)`. Al regenerar, actualiza el aforo de disponibilidades existentes y conserva sus cupos ocupados.
- Al reducir capacidad o cambiar modalidad, la actualización se rechaza si alguna disponibilidad ya tiene más cupos ocupados que el aforo resultante. De lo contrario, sincroniza `cuposTotales` para el servicio en una transacción.
- La validación de horarios compara segundos desde medianoche; `horaFin` debe ser estrictamente posterior a `horaInicio`, aun cuando ambas horas estén expresadas con formatos distintos (`HH:mm` y `HH:mm:ss`).

## Integridad de datos existente

No se modificó el esquema ni se agregó una migración para esta tarea. La migración inicial ya define:

- `CHECK (capacidad_maxima > 0)` en `servicio`.
- `CHECK (hora_fin > hora_inicio)` en `franja_horaria`.
- `CHECK (cupos_ocupados BETWEEN 0 AND cupos_totales)` en `disponibilidad`.

La definición de esos constraints se encuentra en `packages/db/prisma/migrations/20260930132534_init_sport_complex/migration.sql`.

## Límite de alcance: reserva concurrente

La consulta `GET /api/bookings?serviceId=<id>&date=YYYY-MM-DD` entrega las franjas futuras con su saldo de cupos. La creación `POST /api/bookings` requiere sesión activa de cliente y recibe `serviceId`, `startTime`, `endTime` y `cantidadCupos` (opcional, predeterminado a 1). El endpoint crea un bloqueo `PENDIENTE_PAGO` de 30 minutos, incrementa los cupos ocupados dentro de una transacción y usa `SELECT ... FOR UPDATE` sobre la disponibilidad antes de validar el aforo.

Los bloqueos vencidos se marcan `EXPIRADA` y liberan cupos dentro de la transacción de consulta o de un nuevo bloqueo para esa franja. Esto es liberación bajo demanda; no se añadió un proceso cron ni una migración. La creación de intents y confirmación de pagos Stripe (`RF-09`), así como la emisión de tickets, permanecen fuera de esta tarea.

## Archivos y pruebas

- Lógica de generación y actualización: `packages/db/src/repositories/services.ts`
- Consulta de disponibilidad y bloqueo transaccional: `packages/db/src/repositories/bookings.ts`
- API de disponibilidad y bloqueo: `apps/web/src/app/api/bookings/route.ts`
- Validación de franjas: `packages/validation/src/service.schema.ts`
- Validación de solicitudes de reserva: `packages/validation/src/booking.schema.ts`
- Pruebas del repositorio: `packages/db/test/services.repository.test.ts`
- Pruebas de aforo concurrente y TTL: `packages/db/test/bookings.repository.test.ts`
- Pruebas de validación: `packages/validation/test/service.schema.test.ts`
- Pruebas de solicitudes: `packages/validation/test/booking.schema.test.ts`

Verificación realizada:

- `pnpm --filter @sportcomplex/db test`
- `pnpm --filter @sportcomplex/db exec tsx --test test/service.schema.test.ts test/booking.schema.test.ts`
- `pnpm --filter @sportcomplex/db typecheck`
- `pnpm --filter web typecheck`

El script estándar de pruebas de `@sportcomplex/validation` usa `node --experimental-strip-types`; en un entorno cuyo Node no tenga soporte para esa opción, ejecutar las pruebas con `tsx`. El typecheck de `web` puede reportar imports de rutas antiguas ausentes en `.next/types/validator.ts`; esos diagnósticos son independientes de esta implementación.
