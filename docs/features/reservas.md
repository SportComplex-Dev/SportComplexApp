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
# TSK-BE-09 — Bloqueo temporal de franja en el checkout

> Historia: HU-09 (RF-08 / RN-04, revisada: TTL 30 min) · Fase F2 · Backend · SCRUM-113
> Dependencias: TSK-BD-07 (reserva transaccional), TSK-BD-08 (job de expiración TTL)

## Alcance implementado (opción C aprobada)

`POST /api/bookings/lock` bloquea la franja para terceros y crea la Checkout
Session de Stripe en dos pasos:

1. **TX1 (`createBookingHold`)** — única transacción que toca el row-lock:
   `SELECT ... FOR UPDATE` sobre `DISPOSIBILIDAD`, liberación perezosa de holds
   vencidos, validación de ventana 15 días (`America/Bogota`), mantenimiento,
   aforo y modalidad `EXCLUSIVA`; `cupos_ocupados += N` y creación de `RESERVA`
   en `PENDIENTE_PAGO` con `expira_en = now + 30 min` y `pagoId = NULL`.
2. **Stripe Checkout Session (fuera de transacción)** — `expires_at = now + 30
   min` (coincide con el TTL del hold), `metadata = { bookingId, userId }` (que
   también se propaga a `payment_intent_data`), y respuesta
   `{ reserva, checkout.url, checkout.expiresAt }`.

Si el paso 2 falla, `compensateFailedCheckout(reservaId)` libera el hold con la
misma transición idempotente del job (`PENDIENTE_PAGO → EXPIRADA`,
`cupos_ocupados = GREATEST(0, -N)`), **sin crear `PAGO`** y sin bloqueos
huérfanos.

### Decisión: el `PAGO` NO se crea en el lock

Verificado contra la API real de Stripe (`2026-08-26.dahlia`): la Checkout
Session en modo `payment` crea el PaymentIntent **asíncronamente** —
`payment_intent` es `null` hasta que el cliente completa el pago
(`checkout.session.completed`), incluso con `payment_method_types: ["card"]` y
`expand`. Por eso no existe TX2 en TSK-BE-09 y `PAGO.stripe_payment_intent_id`
se mantiene `NOT NULL UNIQUE`, tal como lo documenta el MER ("idempotencia del
webhook").

**Punto de integración RF-09:** el webhook `checkout.session.completed` /
`payment_intent.succeeded` localizará la reserva por
`checkout.session.metadata.bookingId` y llamará a
`attachPendingPagoToReserva` (`packages/db/src/repositories/checkout.ts`) con el
`pi_...` real — creando el `PAGO` idempotentemente (UNIQUE + captura de
`P2002`) y ejecutando `PENDIENTE_PAGO → CONFIRMADA`.

### Contrato de estados (RESERVA)

| Transición | Actor | Garantía |
|---|---|---|
| `∅ → PENDIENTE_PAGO` | `POST /api/bookings/lock` (TX1) | `expira_en = now + 30 min`, `pagoId = NULL` |
| `PENDIENTE_PAGO → EXPIRADA` | Job `expireReservasVencidas`, limpieza perezosa o `compensateFailedCheckout` | Guarda condicional `estado='PENDIENTE_PAGO'`; cupos liberados una sola vez |
| `PENDIENTE_PAGO → CONFIRMADA` | **Fuera de alcance** — webhook Stripe (RF-09) | Requiere `PAGO=APROBADO` y `pagoId` enlazado |

### Contrato de estados (PAGO)

| Transición | Actor | Garantía |
|---|---|---|
| `∅ → PENDIENTE` | **Fuera de alcance** — webhook RF-09 | Requiere `pi_...` real (`NOT NULL UNIQUE`) |
| `PENDIENTE → APROBADO / FALLIDO` | **Fuera de alcance** — webhook RF-09 | Idempotencia por UNIQUE de `stripe_payment_intent_id` |

Regla crítica respetada: el único mecanismo de bloqueo temporal es
`RESERVA.expira_en`; **no existe ni debe crearse** una columna `locked_at`.

## Revisión del requisito: TTL 15 → 30 minutos

Stripe Checkout Sessions exige `expires_at >= 30 min` (mínimo de plataforma);
un TTL de 15 min haría fallar la creación de la sesión. Por decisión de
implementación (documentada en SRS RF-08 / RN-04 / Decisión 6), el bloqueo del
cupo se unificó a **30 minutos**: sesión y hold comparten horizonte, sin
ventana huérfana. Pendiente reflejar el cambio en SCRUM-113 y FE-09 en Jira
(FE-09 debe inicializar el countdown desde `reserva.expiraEn`).

## Idempotencia y concurrencia

- **TX1** serializa competidores con `FOR UPDATE`; `cuposOcupados` nunca se
  toca fuera de esa transacción (auditoría TSK-BD-07).
- **Compensación segura**: una reserva ya `CONFIRMADA` por el webhook nunca se
  degrada a `EXPIRADA` ni pierde cupos.
- I/O de red (Stripe) jamás dentro del `FOR UPDATE` de TX1.
- La liberación de cupos por abandono corre por el job TSK-BD-08 (cada minuto)
  + limpieza perezosa; **no depende de que exista `PAGO`**.

## Archivos y pruebas

- Checkout Session (params puros + cliente inyectable): `packages/core/src/integrations/stripe.ts`
- Compensación + helper de asociación (RF-09): `packages/db/src/repositories/checkout.ts`
- TX1 (existente, reutilizado): `packages/db/src/repositories/bookings.ts` (`createBookingHold`)
- Job de expiración (existente, sin cambios): `packages/db/src/repositories/expirations.ts` + `packages/db/src/jobs/expire.ts` + `apps/web/src/app/api/cron/expire-reservas/route.ts`
- Endpoint exclusivo de checkout: `apps/web/src/app/api/bookings/lock/route.ts` (`POST /api/bookings` existente queda intacto)
- Constantes de dominio: `packages/core/src/domain/index.ts` (`CHECKOUT_TTL_MINUTES = 30`), `packages/core/src/services/availability.ts`
- Pruebas Stripe (puras, sin SDK): `packages/core/src/integrations/stripe.test.ts`
- Pruebas compensación/asociación (fake-db): `packages/db/test/checkout.repository.test.ts`
- Smoke real contra Stripe test mode: `packages/db/scripts/smoke-be09.mts` (`pnpm --filter @sportcomplex/db smoke:be09`; requiere datos semilla, ver `scripts/db-seed-availability.mts`)
- Documentación del repositorio: `packages/db/README.md` §9

Verificación realizada:

- `pnpm --filter @sportcomplex/db test` (27/27, incluye concurrencia TSK-BE-05 y TTL TSK-BD-08)
- `pnpm --filter @sportcomplex/core test` (31/31)
- `pnpm --filter @sportcomplex/db typecheck` / `@sportcomplex/core typecheck` / `web typecheck`
- `pnpm --filter @sportcomplex/db smoke:be09` contra Stripe test mode: TX1 OK,
  sesión `cs_test_...` con `expires_at` 30 min, `paymentIntentId = null`, sin
  `PAGO` creado, compensación e idempotencia OK.

Nota de entorno: si los tests fallan con `@prisma/client does not provide an export named 'PrismaClient'`, correr primero `pnpm --filter @sportcomplex/db db:generate` (pnpm no ejecuta el generate tras `install`).

Restricción adicional de plataforma detectada: Stripe exige monto mínimo
equivalente a ~0.50 USD (≈ 2.000 COP); tarifas por debajo de ese umbral
fallan con `amount_too_small` al crear la sesión.

## Códigos de error del endpoint

| Situación | HTTP | code |
|---|---|---|
| Sin sesión / rol distinto de CLIENTE / cuenta no ACTIVA | 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` |
| Payload inválido | 400 | `VALIDATION_ERROR` |
| Franja inexistente | 404 | `SLOT_NOT_FOUND` |
| Franja en el pasado / bloqueada por mantenimiento / sin cupo / servicio inactivo | 409 | `SLOT_IN_PAST` / `SLOT_BLOCKED` / `CAPACITY_EXCEEDED` / `SERVICE_UNAVAILABLE` |
| Solapamiento del mismo titular en la misma instancia de servicio (TSK-BE-12) | 409 | `TITULAR_RESERVATION_OVERLAP` |
| Fecha fuera de la ventana de 15 días | 400 | `OUTSIDE_BOOKING_WINDOW` |
| `STRIPE_SECRET_KEY` ausente | 503 | `STRIPE_NOT_CONFIGURED` |
| Fallo creando la sesión de Stripe (hold compensado) | 502 | `CHECKOUT_STRIPE_FAILED` |
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
- **Stripe Checkout Consolidado**: Creación de una única sesión de Stripe Checkout con múltiples `line_items` y registro de los identificadores de reserva en los metadatos para confirmación conjunta en el webhook RF-09.# TSK-BE-13 — Historial de reservas con cursor

## Endpoint

`GET /api/bookings/history?status=<estado>&cursor=<cursor>&limit=<n>`

- Requiere sesión de cliente activa y consulta solo reservas cuyo `titularId` coincide con el usuario autenticado.
- `status` es obligatorio y acepta únicamente `CONFIRMADA`, `EXPIRADA` o `CANCELADA_ADMINISTRATIVA`. El estado `CANCELADA` representa exclusivamente cancelaciones administrativas; no se agrega cancelación por autoservicio.
- `limit` es opcional (20 por defecto; rango 1–50).
- La respuesta contiene `items`, `nextCursor` y `hasMore`.

## Orden y estabilidad

Las páginas usan keyset pagination descendente por `(creadoEn, id)`, con `id` como desempate. El cursor codifica esos valores; no se usa offset. Las inserciones posteriores quedan antes del cursor y no desplazan los elementos de páginas ya recorridas.

El modelo `Reserva` declara el índice compuesto `@@index([titularId, estado, creadoEn, id])`, que acompaña el keyset: el prefijo de igualdad `(titularId, estado)` más el orden descendente `(creadoEn, id)` sin necesidad de un sort adicional. Se aplica con la migración `20261011130000_reserva_history_keyset_index` (reemplaza al índice previo `[titularId, estado]`). Las pruebas verifican conjuntos disjuntos por estado, aislamiento por titular y estabilidad al insertar una reserva nueva.
