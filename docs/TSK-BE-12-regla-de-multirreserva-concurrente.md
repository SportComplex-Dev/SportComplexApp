# TSK-BE-12 — Regla de multirreserva concurrente

> Historia: HU-12 (RF-11 / RN-07) · Fase F2 · Backend · SCRUM-120
> Dependencias: `TSK-BE-09` (bloqueo temporal de franja)

## Regla implementada

La **unicidad de titular se aplica solo dentro de la misma instancia de servicio**. Entre
categorías o instancias distintas, el solapamiento horario es válido.

- Un mismo `titularId` **no** puede tener dos reservas vivas (`PENDIENTE_PAGO` o
  `CONFIRMADA`) que se solapen en el tiempo para el **mismo `servicioId`** en la misma fecha.
- Reservar `"Cancha 1"` y `"Piscina"` en la misma franja y fecha se confirma **sin error de
  solapamiento** (criterio de aceptación clave).
- Estados `EXPIRADA` y `CANCELADA_ADMINISTRATIVA` nunca bloquean.
- Un hold `PENDIENTE_PAGO` cuyo `expiraEn` ya venció deja de bloquear al titular (coherente
  con la limpieza perezosa de TSK-BD-08); el cupo lo libera esa misma limpieza.

## Dónde vive

`packages/db/src/repositories/bookings.ts` → `assertNoTitularOverlap(tx, ...)`, invocada dentro
de la misma transacción de `createBookingHold` que hace el `SELECT ... FOR UPDATE` sobre
`DISPONIBILIDAD`. No se crea ni se modifica ninguna migración: el filtro usa el índice
existente `reserva(titular_id, estado)` y la relación `disponibilidad → franja_horaria`.

La evaluación del solapamiento compara segundos dentro del día
(`[otraInicio, otraFin) ∩ [inicio, fin) ≠ ∅`), por lo que franjas contiguas (10:00–11:00 y
11:00–12:00) **no** se consideran solapadas, y franjas parcialmente solapadas del mismo
servicio sí.

El endpoint no cambia: `POST /api/bookings` y `POST /api/bookings/lock` ya propagan
`BookingError.code`/`status` a la respuesta, así que el nuevo código aparece sin tocar la capa
de API.

## Códigos de error

| Situación | HTTP | code |
|---|---|---|
| El titular ya tiene una reserva viva solapada del **mismo** servicio | 409 | `TITULAR_RESERVATION_OVERLAP` |
| Solapamiento entre **servicios distintos** (Cancha 1 + Piscina) | — | ninguno: se confirma |

## Archivos y pruebas

- Regla: `packages/db/src/repositories/bookings.ts` (`assertNoTitularOverlap`)
- Pruebas: `packages/db/test/bookings.repository.test.ts` (4 casos TSK-BE-12)
- Soporte de mock: `packages/db/test/mock-prisma.ts` (filtro por relación `disponibilidad`,
  `estado: { in: [...] }` y `select` anidado en `reserva.findMany`)

Verificación realizada:

- `pnpm --filter @sportcomplex/db test` → 49/49
- `pnpm --filter @sportcomplex/db typecheck`

Nota: la prueba de concurrencia de TSK-BE-05 (40 solicitudes sobre aforo 25) ahora usa
titulares distintos, porque con un único titular la nueva regla limita a una sola reserva
activa por servicio y la prueba mediría unicidad de titular en lugar de aforo.

## Tarea complementaria: TSK-BE-12b (SCRUM-163)

Para completar el criterio de aceptación de frontend en **TSK-FE-12** (*"dos servicios distintos en la misma franja o diferente franja se pueden seleccionar y pagar juntos"*), se definió **TSK-BE-12b**:
- **Alcance**: Soporte transaccional en backend para recibir lotes de reservas (`items: Array<BookingRequest>`).
- **Transacción Atómica**: Bloqueo atómico (*all-or-nothing*) de todas las franjas seleccionadas, validando aforos, mantenimiento y la regla de no-solapamiento (`assertNoTitularOverlap`) entre los ítems y las reservas previas.
- **Stripe Checkout Consolidado**: Creación de una única sesión de Stripe Checkout con múltiples `line_items` y registro de los identificadores de reserva en los metadatos para confirmación conjunta en el webhook RF-09.