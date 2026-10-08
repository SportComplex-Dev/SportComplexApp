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
| Fecha fuera de la ventana de 15 días | 400 | `OUTSIDE_BOOKING_WINDOW` |
| `STRIPE_SECRET_KEY` ausente | 503 | `STRIPE_NOT_CONFIGURED` |
| Fallo creando la sesión de Stripe (hold compensado) | 502 | `CHECKOUT_STRIPE_FAILED` |
