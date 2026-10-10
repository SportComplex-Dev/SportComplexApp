# TSK-BD-09 — Idempotencia de pagos con Stripe (HU-10 / RF-09)

> Rama de trabajo: `feature/tsk-bd-09-idempotencia-de-pagos-con-stripe`
> Responsable: Milton Ortega · 3 pts · Fase F2 · Componente: Database & Analytics · Depende de `TSK-BD-06`
> Sprint: SP1 - Core & Reservas Cashless · Fecha de implementación: 2026-10-08

## 1. Qué se hizo y por qué

La base de datos **ya tenía** el constraint (entregado con `TSK-BD-06`), pero no
existía código que lo explotara: el webhook devolvía `501 NOT_IMPLEMENTED` y
ninguna parte del sistema escribía en la tabla `PAGO` ni pasaba una reserva a
`CONFIRMADA`. El criterio de aceptación era imposible de cumplir:

> *Reenviar el mismo webhook dos veces deja **una sola** fila en `PAGO` y
> **una sola** reserva en `CONFIRMADA`.*

| # | Cambio | Archivo |
|---|--------|---------|
| 1 | Repositorio de pagos: upsert transaccional + confirmación/activación condicional | `packages/db/src/repositories/payments.ts` |
| 2 | Export del repositorio en el paquete | `packages/db/src/index.ts` |
| 3 | Webhook Stripe real: verificación de firma + procesamiento idempotente | `apps/web/src/app/api/payments/route.ts` |
| 4 | Helpers de contrato de metadatos y monto | `packages/core/src/integrations/stripe.ts` (+ export en `packages/core/src/index.ts`) |
| 5 | Test del criterio de aceptación a nivel repositorio (7 tests) | `packages/db/src/repositories/payments.test.ts` |
| 6 | Test end-to-end del webhook con firma firmada (4 tests) | `apps/web/src/app/api/payments/__tests__/route.test.ts` |
| 7 | Soporte de `pago`/`membresia` + `WHERE id` en el mock de Prisma | `packages/db/test/mock-prisma.ts` |

**No hubo migraciones nuevas**: el `UNIQUE (stripe_payment_intent_id)` ya vive
en `migrations/20260930132534_init_sport_complex/migration.sql:270`
(`pago_stripe_payment_intent_id_key`) y en `schema.prisma:229` (`@unique`).

## 2. Cómo funciona la idempotencia (las 3 capas)

```
Stripe reintenta el evento (mismo byte a byte)
        │
        ▼
POST /api/payments ──► 1) constructEvent(payload, firma, whsec)   ← rechaza payloads ajenos
        │
        ▼
procesarPagoWebhook(input)   ← UNA transacción Prisma:
        │
        ├─ 2) upsert PAGO por stripe_payment_intent_id
        │      · no existe → create
        │      · ya existe → no duplica; solo avanza estado (jamás APROBADO → FALLIDO)
        │      · carrera concurrente → P2002 (UNIQUE) → reintenta la transacción (≤3)
        │
        ├─ 3) UPDATE reserva SET estado='CONFIRMADA'
        │      WHERE id = :reservaId AND estado='PENDIENTE_PAGO'   ← exactamente 1 gana
        │
        └─ 4) UPDATE membresia SET estado='VIGENTE'
               WHERE id = :membresiaId AND estado<>'VIGENTE'        ← exactamente 1 gana
```

Garantías:

- **1 fila en `PAGO` siempre**: la garantía la da el índice único del motor
  (no el código). Reintentos y carreras convergen a la misma fila.
- **1 sola transición a `CONFIRMADA`**: los updates son condicionales; la
  segunda corrida ve `count === 0` y es un no-op reportado en el resultado.
- **Respuesta predecible**: el webhook siempre responde `200` si el evento fue
  procesado o ignorado; `500` solo ante error inesperado (Stripe reintentará y
  la siguiente corrida es idempotente).

## 3. Guía para el equipo de BACKEND

### 3.1. Variables de entorno (ya existentes en `apps/web/.env.example`)

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Si faltan, el endpoint responde `503 STRIPE_NOT_CONFIGURED` (no rompe nada).

### 3.2. Endpoint

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `POST` | `/api/payments` | Firma Stripe (no sesión) | Verifica firma y procesa `payment_intent.succeeded` / `payment_intent.payment_failed` |

Registrarlo en el dashboard de Stripe (o con la CLI):

```bash
stripe listen --forward-to localhost:3000/api/payments
stripe trigger payment_intent.succeeded   # o reenviar 2 veces: no duplica
```

### 3.3. Contrato de respuesta

```jsonc
// 200 — procesado (primera vez o reintento)
{ "success": true, "data": {
    "received": true, "pagoId": "…", "pagoCreado": true, "duplicado": false,
    "estado": "APROBADO", "reservaConfirmada": true, "reservaEstado": "CONFIRMADA",
    "membresiaActivada": false
}, "timestamp": "…" }

// 200 — ignorado a propósito (Stripe deja de reintentar)
{ "success": true, "data": { "received": true, "ignored": true,
    "reason": "EVENT_TYPE_NOT_HANDLED" | "MISSING_METADATA" } }

// 400 MISSING_SIGNATURE | INVALID_SIGNATURE · 503 STRIPE_NOT_CONFIGURED · 500 SERVER_ERROR
```

`duplicado: true` + `reservaConfirmada: false` en el segundo envío **es el
comportamiento esperado**, no un error.

### 3.4. Uso directo del repositorio (desde cualquier servicio/worker)

```ts
import { procesarPagoWebhook, PaymentError } from "@sportcomplex/db";

const resultado = await procesarPagoWebhook({
  stripePaymentIntentId: "pi_...",          // único, ≤100 chars
  usuarioId,                                // obligatorio (FK NOT NULL)
  monto: 75000,                             // número o "75000.00" (Decimal(12,2))
  estado: "APROBADO",                       // PENDIENTE | APROBADO | FALLIDO
  tipo: "RESERVA",                          // RESERVA | MEMBRESIA
  reservaId,                                // opcional → confirma la reserva
  membresiaId,                              // opcional → activa la membresía
});
// resultado: { pagoId, pagoCreado, duplicado, estado,
//              reservaConfirmada, reservaEstado, membresiaActivada }
```

Errores: lanza `PaymentError` (`VALIDATION_ERROR`, HTTP 400) ante entrada
inválida; cualquier otro error debe mapearse a `500` y dejar que Stripe reenvíe.

### 3.5. Crear el PaymentIntent (próximo paso — Flujo POS / checkout)

Todavía no existe `POST /api/payments/intent` (fuera del alcance de esta task,
vive en `feature/pos-stripe-cashless`). Cuando se cree, **debe** llevar los
metadatos definidos en core:

```ts
import { buildPaymentMetadata, stripeAmountToMonto, STRIPE_CURRENCY } from "@sportcomplex/core";

await stripe.paymentIntents.create({
  amount: 75000_00,                         // centavos: 75000.00 → stripeAmountToMonto(7500000)
  currency: STRIPE_CURRENCY,                // "cop"
  metadata: buildPaymentMetadata({ bookingId, userId, membershipId }),
});
```

Reglas del contrato de metadatos:

| Metadato | Obligatorio | Efecto en el webhook |
|---|---|---|
| `userId` | **Sí** | Dueño del `PAGO`; sin él el evento se ignora |
| `bookingId` | Para reservas | `tipo = RESERVA` y confirma la reserva |
| `membershipId` | Para membresías | `tipo = MEMBRESIA` y activa la membresía |
| `cashless` | Informativo | Marcado por `buildPaymentMetadata` (RN-13) |

Si llega un evento con los tres vacíos → `200 ignored / MISSING_METADATA`
(otro flujo de Stripe, p. ej. suscripciones, no debe romper este endpoint).

## 4. Guía para el equipo de FRONTEND

### 4.1. Qué garantiza el sistema hoy (ya usable)

1. **Reserva con hold**: `POST /api/bookings` crea la reserva en
   `PENDIENTE_PAGO` con TTL de 15 min (`createBookingHold`).
2. **Pago confirmado**: cuando Stripe notifique el `payment_intent.succeeded`,
   la reserva pasa sola a `CONFIRMADA` — el usuario ve el cambio al refrescar.
3. **Reintentos seguros**: si la conexión del checkout falla y el usuario
   reintenta el mismo pago, **no** se duplica la reserva ni el cobro.

### 4.2. Cómo consultar el estado de la reserva (para pintar la UI)

```ts
// Mientras el pago se procesa (estado del hold):
//   PENDIENTE_PAGO → mostrar "Procesando pago…" + countdown de 15 min (expiraEn)
//   CONFIRMADA     → éxito; mostrar el código QR del ticket
//   EXPIRADA       → el hold venció: reintentar reserva (la franja se liberó)
```

> El estado nunca pasa a `CONFIRMADA` por JS local: **solo** el webhook lo
> hace. Si el PaymentIntent termina `succeeded`, confía en el refresco.

### 4.3. Checkout con Stripe Elements (pendiente — `feature/pos-stripe-cashless`)

Los componentes ya están instalados (`@stripe/stripe-js`,
`@stripe/react-stripe-js`) y hay TODOs marcados en:

- `apps/web/src/app/(customer)/portal/book/page.tsx` — Elements + selector de franjas + timer TTL
- `apps/web/src/app/(staff)/pos/page.tsx` — POS cashless

Flujo previsto:

1. Backend: `POST /api/payments/intent` (futuro) → devuelve `client_secret`.
2. Frontend: `<Elements stripe={...} options={{ clientSecret }}>` → `<PaymentElement>` → `confirmPayment`.
3. Al confirmar: redirigir/poll a la reserva esperando `CONFIRMADA`
   (webhook normalmente llega en <2 s; hacer polling cada 2–3 s con tope del TTL).

### 4.4. Errores del webhook que puede ver el usuario

| Código HTTP | `error.code` | Significado para la UI |
|---|---|---|
| 400 | `INVALID_SIGNATURE` / `MISSING_SIGNATURE` | Error de integración (no mostrar al usuario; loguear) |
| 503 | `STRIPE_NOT_CONFIGURED` | Entorno sin claves: avisar al equipo, no reintentar |
| 500 | `SERVER_ERROR` | Transitorio: Stripe ya reintenta solo |

## 5. Cómo probarlo

```bash
# Unit + integración (mock de Prisma, sin BD real)
pnpm --filter @sportcomplex/db test        # 7 tests TSK-BD-09
pnpm --filter web test                     # 4 tests TSK-BD-09 (webhook firmado)

# End-to-end local con Stripe CLI
stripe listen --forward-to localhost:3000/api/payments
pnpm --filter web dev
# ... crear un pago y reenviar el evento 2 veces desde el dashboard de Stripe
```

**Criterio de aceptación cubierto por:**

- `packages/db/src/repositories/payments.test.ts` → *"reenviar el mismo webhook
  dos veces → 1 fila en PAGO y 1 reserva CONFIRMADA"* (+ carrera por `P2002`).
- `apps/web/src/app/api/payments/__tests__/route.test.ts` → mismo escenario a
  través del endpoint HTTP con firma verificada.

## 6. Fuera de alcance (no incluido en esta task)

- `POST /api/payments/intent` (creación de PaymentIntents) → `feature/pos-stripe-cashless`.
- UI de checkout / POS con Stripe Elements → tareas FE pendientes.
- Notificación al usuario (email/push) al confirmar → flujo aparte.
- Membresías: aquí solo se registra el pago y se activa de forma idempotente;
  el CRUD de planes/membresías continúa en `TSK-BD-11` (doc:
  `docs/TSK-BD-11-membresias.md`).
