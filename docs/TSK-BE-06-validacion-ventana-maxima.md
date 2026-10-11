# TSK-BE-06 — Validación de la ventana máxima de 15 días en servidor

> Historia: HU-06 (RF-05) · Fase F1 · Backend · SCRUM-101
> Dependencia: TSK-BD-07

## Alcance implementado

- Reglas **RN-01** (ninguna reserva a más de 15 días calendario de anticipación) y **RN-11** (prohibido reservar fechas u horas ya concluidas) centralizadas en el servicio de dominio `@sportcomplex/core`, con `date-fns-tz` bajo `America/Bogota`.
- La ventana se calcula por **fecha calendario legal** en `America/Bogota` (no por diff UTC): una reserva para el día `T + 16` (Bogota) es inválida aunque el instante exacto difiera en UTC.
- `validateBookingWindow(start, now)` lanza `BookingWindowError`; `isWithinBookingWindow` es el wrapper booleano. El mensaje contractual se exporta como `BOOKING_WINDOW_EXCEEDED_MESSAGE` para reutilización.
- Ambos caminos de reserva (`POST /api/bookings` y `POST /api/bookings/lock` de TSK-BE-09) heredan la validación al compartir `createBookingHold`.

## Criterio de aceptación clave

Una petición manipulada con `T + 16 días` recibe **HTTP 400** y el mensaje exacto:

> "La reserva excede la ventana máxima permitida de 15 días"

Es validado de forma end-to-end en `packages/db/test/bookings.repository.test.ts` (`createBookingHold` y `getBookableAvailability`), y unitariamente en `packages/core/src/services/booking-window.test.ts` (T+15 válido, T+16 rechazado, RN-11 pasado, borde medianoche Bogota).

## Implementación y errores

- `packages/db/src/repositories/bookings.ts`: `BookingError(OUTSIDE_BOOKING_WINDOW, 400)` con el mensaje contractual. Las franjas ya iniciadas conservan `SLOT_IN_PAST` (409) y las de fin ≤ inicio `VALIDATION_ERROR` (400).
- `packages/db/src/repositories/availability.ts`: `SLOT_OUT_OF_WINDOW` cambia de 422 a **400** con el mismo mensaje contractual. El comentario JSDoc refleja el nuevo mapeo (`404/400/409`).
- `@sportcomplex/core` depende de `@sportcomplex/db` (no al revés), por lo que el mensaje contractual se declara también en `db` para mantener el validador accesible en ambos lados sin romper el grafo de dependencias.

## Compatibilidad con TSK-BE-09

- No se modificó `CHECKOUT_TTL_MINUTES` (30 min de BE-09), `packages/db/src/repositories/checkout.ts` ni `apps/web/src/app/api/bookings/lock/route.ts`.
- Único conflicto de merge esperado: `packages/core/src/services/availability.ts` (import y línea `checkoutExpiresAt`); se resuelve conservando el TTL de 30 min de BE-09 y las nuevas funciones de ventana.

## Archivos y pruebas

- Validador central: `packages/core/src/services/availability.ts`
- Aplicación en repositorios: `packages/db/src/repositories/bookings.ts`, `packages/db/src/repositories/availability.ts`
- Tests unitarios del dominio: `packages/core/src/services/booking-window.test.ts`
- Test de aceptación: `packages/db/test/bookings.repository.test.ts`

Verificación realizada:

- `pnpm --filter @sportcomplex/core test`
- `pnpm --filter @sportcomplex/db test`
- `pnpm --filter @sportcomplex/core typecheck`
- `pnpm --filter @sportcomplex/db typecheck`
- `pnpm --filter @sportcomplex/validation test` (sin cambios, se mantiene verde)
