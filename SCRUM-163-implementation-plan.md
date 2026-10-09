# Plan de Implementación - SCRUM-163: Bloqueo transaccional multi-servicio y checkout conjunto (Carrito)

## Resumen de Decisiones Confirmadas y Correcciones Técnicas

| Aspecto | Decisión / Corrección |
|---------|----------------------|
| **Endpoint** | Crear `POST /api/bookings/lock-cart` nuevo; conservar `POST /api/bookings/lock` individual. Ambos reutilizan lógica de dominio y validaciones compartidas. |
| **Webhook** | Ampliar `procesarPagoWebhook` para aceptar `reservaIds: string[]` (array) dentro de una **única transacción**. Mantener `reservaId` (string) para compatibilidad. Pago + confirmación de todas las reservas = atómico e idempotente. |
| **Errores** | Estructurados y descriptivos: identificar elemento conflictivo (`serviceId`, `startTime`, `endTime`) y causa (`CAPACITY_EXCEEDED`, `TITULAR_RESERVATION_OVERLAP`, `SLOT_NOT_FOUND`, `SERVICE_UNAVAILABLE`, `SLOT_BLOCKED`, `INVALID_BOOKING_QUANTITY`, `OUTSIDE_BOOKING_WINDOW`). Fallo de cualquier elemento → **abortar operación completa** (transacción única). |
| **Carrito mínimo** | `cartCheckoutSchema.min(2)` obligatorio; flujo individual (`POST /api/bookings/lock`) intacto. Unificación fuera de alcance. |
| **Transacciones** | **Una sola transacción DB** para crear todos los bloqueos del carrito. **No mantener la transacción abierta** durante llamadas a Stripe (I/O de red fuera). |
| **Concurrencia** | Bloquear filas de `DISPONIBILIDAD` en **orden determinista** (p.ej. `servicioId ASC, fecha ASC, franjaId ASC`). Liberar holds expirados **antes** de validar. Validar **todo** antes de incrementar `cuposOcupados` y crear reservas. |
| **Solapamientos** | `assertNoTitularOverlap` validada contra: (1) reservas existentes activas del titular, (2) **entre los propios ítems del carrito** (evitar duplicar mismo servicio en franjas solapadas). Regla: unicidad de titular **solo dentro de la misma instancia de servicio** (TSK-BE-12 / RN-07). |
| **Stripe** | Importes calculados **en servidor** (suma de subtotales). Idempotencia en creación de sesión (clave `stripePaymentIntentId` no existe aún; usar `sessionId` o `metadata.bookingIds` como referencia). **Nunca liberar reservas** por resultado incierto de Stripe (timeout/red): solo liberar por error definitivo. |
| **Relación pago-reservas** | **Modelo actual**: `Pago 1—N Reserva` (FK `pagoId` en `Reserva`). Una **única fila `Pago`** con `monto = total carrito`, `tipo = RESERVA`, vinculada a **todas las reservas** del carrito. No depender solo de `metadata.bookingIds` en Stripe. |
| **Webhook (verificación)** | Verificar: evento (`payment_intent.succeeded`), estado (`APROBADO`), importe (coincidir con `Pago.monto`), moneda (`COP`), usuario (`usuarioId`), **conjunto esperado de `reservaIds`**. Procesar en **única transacción**: upsert `Pago` por `stripePaymentIntentId` + confirmar todas las reservas (`WHERE estado='PENDIENTE_PAGO' AND id IN (...)`). Protección contra duplicados y carreras concurrentes (reintento por `P2002`). |
| **Expiración y recuperación** | - Stripe fallo definitivo → `compensateFailedCheckout` por cada reserva (idempotente).<br>- Resultado incierto (timeout) → **no liberar**; dejar TTL y job de expiración (TSK-BD-08).<br>- Sesión expirada (`expiraEn` vencido) → job libera; webhook tardío ve `EXPIRADA` y **no confirma** (pago queda registrado, reserva no).<br>- Pago recibido con reserva ya no confirmable → registrar `Pago`, no degradar, no confirmar. Evitar sobreventas. |
| **Compatibilidad** | No romper contratos/estados/flujos existentes. `POST /api/bookings/lock` y webhook individual siguen funcionando sin cambios. |

---

## Archivos Afectados y Cambios

| Archivo | Cambio | Dependencia | Estado |
|---------|--------|-------------|--------|
| `packages/validation/src/booking.schema.ts` | **Añadir** `cartCheckoutSchema` (array `items` min 2, mismo shape que `bookingRequestSchema`). Exportar `CartCheckoutRequest`. | — | ✅ Completado |
| `packages/db/src/repositories/bookings.ts` | **Añadir** `createBookingHoldCart(input: { items: CartItem[], userId: string }, now?)`:<br>- Single TX: lock disponibilidades (orden determinista) → release expired → validar todo (capacidad, ventana, modalidad, mantenimiento, solapamientos existentes + intra-carrito) → incrementar `cuposOcupados` → crear todas las `Reserva` `PENDIENTE_PAGO` con **mismo `expiraEn`** → return `{ bookings, total, expiresAt }`.<br>- Reutilizar `assertNoTitularOverlap` extendida para batch.<br>- Errores tipados con `itemIndex`/`serviceId`/`startTime`/`endTime`/`code`. | Validation schema | ✅ Completado |
| `packages/core/src/integrations/stripe.ts` | **Modificar** `CheckoutSessionInput`: `reservaIds: string[]`, `items: { servicioNombre, cantidadCupos, subtotal }[]`, `total`. **Actualizar** `buildCheckoutSessionParams`: múltiples `line_items`, `metadata: { bookingIds: "id1,id2,...", userId, cashless: "true" }`. **Actualizar** `createStripeCheckoutSession` para nuevo input. | DB cart function | ✅ Completado |
| `apps/web/src/app/api/bookings/lock-cart/route.ts` | **Nuevo endpoint** `POST /api/bookings/lock-cart`:<br>1. Auth (CLIENTE ACTIVO).<br>2. Validar `cartCheckoutSchema`.<br>3. `createBookingHoldCart` (TX DB).<br>4. `createStripeCheckoutSession` (fuera de TX).<br>5. **Si Stripe falla (error definitivo)**: `compensateFailedCheckout` para **cada** `booking.id` (secuencial, idempotente).<br>6. Return `{ reservas: Booking[], checkout: { sessionId, url, expiresAt } }`. | DB + Stripe | ✅ Completado |
| `apps/web/src/app/api/bookings/lock/route.ts` | **Actualizar** llamada a `createStripeCheckoutSession` para usar nueva interfaz (`reservaIds[]`, `items[]`). Mantener lógica individual intacta. | Stripe multi-item | ✅ Completado |
| `packages/db/src/repositories/payments.ts` | **Ampliar** `ProcesarPagoInput`: `reservaIds?: string[]` (opcional, array), mantener `reservaId?: string`. **Modificar** `procesarPagoWebhook`:<br>- Si `reservaIds` presente: upsert `Pago` → confirmar **todas** las reservas en un solo `updateMany` condicional `WHERE id IN (...) AND estado='PENDIENTE_PAGO'`.<br>- Idempotencia: reintentos por `P2002` (único `stripePaymentIntentId`) re-ejecutan TX completa.<br>- Verificar importe esperado vs recibido (suma de `Reserva.total` de las `reservaIds`).<br>- Return: `reservasConfirmadas: string[]`, `reservasEstado: Record<string, string>`. | — | 🔄 Pendiente |
| `apps/web/src/app/api/payments/route.ts` | **Modificar** webhook: parsear `metadata.bookingIds` (CSV) → `reservaIds[]`. Llamar `procesarPagoWebhook` con `reservaIds`. Mantener fallback a `reservaId` único si no hay CSV (compatibilidad). | Payments repo | 🔄 Pendiente |
| `packages/db/src/repositories/checkout.ts` | **Revisar** `compensateFailedCheckout`: ya soporta una reserva. Para carrito, se llama en bucle desde endpoint. **No cambios necesarios** si es idempotente por reserva. | — | ✅ Sin cambios |

---

## Orden de Implementación (Dependencias Reales)

```
1. packages/validation/src/booking.schema.ts
   └─ (ninguna)

2. packages/db/src/repositories/bookings.ts → createBookingHoldCart()
   └─ depende de: #1 (validación), assertNoTitularOverlap existente

3. packages/core/src/integrations/stripe.ts → multi-item session
   └─ depende de: #2 (estructura de retorno)

4. apps/web/src/app/api/bookings/lock-cart/route.ts
   └─ depende de: #2, #3, compensateFailedCheckout (existente)

5. packages/db/src/repositories/payments.ts → procesarPagoWebhook multi-reserva
   └─ depende de: modelo de datos (Pago 1—N Reserva ya existe)

6. apps/web/src/app/api/payments/route.ts → webhook multi-booking
   └─ depende de: #5

7. Tests (ver sección Tests)
   └─ depende de: #1–#6
```

---

## Criterios de Aceptación Actualizados

| Criterio | Descripción |
|----------|-------------|
| **CA-1** | Cliente envía 2+ servicios distintos (misma/diferente franja) → recibe **una** URL Stripe Checkout con importe consolidado. |
| **CA-2** | Si **cualquier** ítem falla (sin cupos, solapado mismo servicio, mantenimiento, fuera de ventana) → **transacción completa abortada**, **cero** holds creados, **cero** incrementos de `cuposOcupados`. Error JSON identifica `itemIndex`, `serviceId`, `code`. |
| **CA-3** | Stripe fallo definitivo (p.ej. `card_declined`, config error) → `compensateFailedCheckout` ejecutado para **cada** reserva del lote; todas pasan a `EXPIRADA`, cupos liberados. |
| **CA-4** | Stripe timeout/resultado incierto → **no liberar**; reservas quedan `PENDIENTE_PAGO` con TTL 30 min. Job TSK-BD-08 expira y libera si vence. |
| **CA-5** | Webhook `payment_intent.succeeded` → **una** fila `Pago` (total carrito), **todas** las reservas `PENDIENTE_PAGO → CONFIRMADA` en **una transacción**, `pagoId` asignado a cada una. |
| **CA-6** | Webhook duplicado/concurrente (mismo `stripePaymentIntentId`) → **una** fila `Pago`, confirmación idempotente (`count === n` solo en primera ejecución). |
| **CA-7** | Webhook importe ≠ suma esperada → `PaymentError` `AMOUNT_MISMATCH` (400), no confirmar reservas. |
| **CA-8** | Webhook con reserva ya `EXPIRADA`/`CONFIRMADA` → `Pago` registrado, reserva **no** confirmada (no sobreventa), `reservaEstado` informado. |
| **CA-9** | `POST /api/bookings/lock` individual **sin cambios**: crea 1 hold, 1 sesión Stripe, webhook individual sigue funcionando. |
| **CA-10** | Concurrencia: 2+ requests simultáneos por mismos cupos → solo uno gana (row-lock determinista + validación atómica). |

---

## Pruebas Adicionales Requeridas

| Archivo de Test | Casos |
|-----------------|-------|
| `packages/db/test/bookings.repository.test.ts` | - `createBookingHoldCart`: éxito 2+ servicios distintos misma/diferente franja.<br>- Fallo atómico: 1 ítem sin cupos → 0 holds creados.<br>- Solapamiento intra-carrito: mismo servicio 2 veces → `TITULAR_RESERVATION_OVERLAP` con `itemIndex`.<br>- Solapamiento con reserva existente activa → `TITULAR_RESERVATION_OVERLAP`.<br>- Orden determinista de locks (evitar deadlocks).<br>- Concurrencia: 2 carritos compitiendo por mismos cupos → uno gana, otro `CAPACITY_EXCEEDED`. |
| `packages/core/test/stripe.test.ts` | - `buildCheckoutSessionParams`: múltiples `line_items`, `metadata.bookingIds` CSV.<br>- `createStripeCheckoutSession`: idempotencia (mismo `sessionId` no duplicado), error definitivo vs timeout. |
| `packages/db/src/repositories/payments.test.ts` | - `procesarPagoWebhook` con `reservaIds[]`: confirma todas atómicamente.<br>- Webhook duplicado multi-reserva → 1 pago, 0 confirmaciones extra.<br>- Carrera `P2002` multi-reserva → reintenta TX, no duplica.<br>- Importe recibido ≠ suma `Reserva.total` → `AMOUNT_MISMATCH`.<br>- Algunas reservas `EXPIRADA` + otras `PENDIENTE_PAGO` → confirma solo pendientes, pago registrado.<br>- FALLIDO tardío tras APROBADO → no degrada. |
| `apps/web/src/app/api/bookings/lock-cart/__tests__/route.test.ts` | - Endpoint completo: auth, validación, TX DB, Stripe, respuesta.<br>- Stripe fallo definitivo → compensación de todas las reservas.<br>- Stripe timeout simulado → no compensar, reservas quedan pendientes.<br>- Errores estructurados con `itemIndex`/`code`. |
| `apps/web/src/app/api/payments/__tests__/route.test.ts` | - Webhook multi-booking: parse CSV `bookingIds`, llama `procesarPagoWebhook` con array.<br>- Compatibilidad: webhook individual (sin CSV) sigue funcionando.<br>- Firma Stripe inválida → 400. |

---

## Verificaciones de Modelo de Datos (Pre-Implementación)

| Verificación | Estado | Nota |
|--------------|--------|------|
| `Pago 1—N Reserva` (FK `pagoId` nullable en `Reserva`) | ✅ Existente | `model Pago { reservas Reserva[] }`, `model Reserva { pago Pago? @relation(fields: [pagoId], references: [id]) }` |
| `stripePaymentIntentId` UNIQUE en `Pago` | ✅ Existente | `@@unique([stripePaymentIntentId])` |
| `Reserva.estado` enum incluye `PENDIENTE_PAGO`, `CONFIRMADA`, `EXPIRADA` | ✅ Existente | |
| Índice parcial `reserva_expira_ttl_idx` para job expiración | ✅ Existente | Migración SQL raw |
| `compensateFailedCheckout` idempotente por reserva | ✅ Existente | `WHERE estado='PENDIENTE_PAGO'` |
| `assertNoTitularOverlap` respeta RN-07 (mismo servicio) | ✅ Existente | Filtra por `servicioId` |

**No se requieren migraciones de esquema** para esta tarea. El modelo actual soporta 1 `Pago` → N `Reserva`.

---

## Riesgos Identificados y Mitigación

| Riesgo | Mitigación |
|--------|------------|
| **Deadlock** entre carritos concurrentes por misma disponibilidad | Lock orden determinista (`servicioId ASC, fecha ASC, franjaId ASC`) en `createBookingHoldCart`. |
| **Stripe timeout** deja holds huérfanos | No compensar en timeout; confiar en TTL 30 min + job TSK-BD-08. Documentar en comentarios. |
| **Webhook amount mismatch** (manipulación cliente) | Validar en servidor: sumar `Reserva.total` de `reservaIds` y comparar con `intent.amount`. Rechazar si difiere. |
| **Sesión Stripe expirada** pero webhook llega tarde | Webhook verifica `Reserva.estado === 'PENDIENTE_PAGO'` antes de confirmar. Si `EXPIRADA`, registra pago pero no confirma. |
| **Duplicación de Pago** por reintentos Stripe | `stripePaymentIntentId` UNIQUE + reintento TX en `procesarPagoWebhook` (máx 3 intentos). |

---

## Progreso Actual

| Paso | Componente | Estado |
|------|------------|--------|
| 1 | `packages/validation/src/booking.schema.ts` | ✅ Completado |
| 2 | `packages/db/src/repositories/bookings.ts` — `createBookingHoldCart()` | ✅ Completado |
| 3 | `packages/core/src/integrations/stripe.ts` — multi-item session | ✅ Completado |
| 4 | `apps/web/src/app/api/bookings/lock-cart/route.ts` | ✅ Completado |
| 4b | `apps/web/src/app/api/bookings/lock/route.ts` — compatibilidad | ✅ Completado |
| 5 | `packages/db/src/repositories/payments.ts` — `procesarPagoWebhook` multi-reserva | 🔄 Pendiente |
| 6 | `apps/web/src/app/api/payments/route.ts` — webhook multi-booking | 🔄 Pendiente |
| 7 | Tests adicionales (ver sección Tests) | 🔄 Pendiente |

## Próximos Pasos

1. **Implementar** paso 5: ampliar `procesarPagoWebhook` en `packages/db/src/repositories/payments.ts` para aceptar `reservaIds[]`.
2. **Implementar** paso 6: actualizar webhook `apps/web/src/app/api/payments/route.ts` para parsear CSV `bookingIds`.
3. **Ejecutar** tests y typecheck tras cada cambio.
4. **Validar** criterios de aceptación CA-1 a CA-10.