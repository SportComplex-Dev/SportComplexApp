# TSK-BE-10 — Webhook de Stripe firmado e idempotente + guía de integración Frontend

- **Ticket:** [SCRUM-114] TSK-BE-10 · **Historia:** HU-10 (RF-09)
- **Microcelda:** Backend / Frontend
- **Depende de:** TSK-BD-09 (idempotencia de pagos)
- **Endpoints:** `POST /api/payments` (canónico) · `POST /api/webhooks/stripe` (alias)

> Este documento describe **(1)** los cambios implementados en el backend para
> cerrar el alcance de TSK-BE-10 y **(2)** cómo el equipo de Frontend consume el
> resultado (confirmación de reserva, emisión del QR y pago fallido).

---

## 1. Resumen de cambios (backend)

| # | Cambio | Archivo |
|---|--------|---------|
| 1 | `payment_intent.succeeded` → reserva `CONFIRMADA` **+ emisión del `TICKET_QR` (`EMITIDO`)** en la misma transacción | `packages/db/src/repositories/payments.ts` |
| 2 | `payment_intent.payment_failed` → reserva `PENDIENTE_PAGO → CANCELADA_PAGO` **+ restitución de la franja** (`cupos_ocupados -= cantidad`) | `packages/db/src/repositories/payments.ts` |
| 3 | Nuevo estado de reserva `CANCELADA_PAGO` | `packages/db/prisma/schema.prisma` + migración `20261009120000_reserva_cancelada_pago_enum` |
| 4 | Alerta de pago fallido (n8n, *fire-and-forget*) | `apps/web/src/app/api/payments/route.ts` |
| 5 | Alias de ruta `/api/webhooks/stripe` (reexporta el handler canónico) | `apps/web/src/app/api/webhooks/stripe/route.ts` |
| 6 | Campos nuevos en la respuesta del webhook: `ticketQrEmitido`, `franjaRestituida` | `packages/db/src/repositories/payments.ts` |

Garantías de idempotencia (se conservan): `UNIQUE(stripe_payment_intent_id)` en
`PAGO`, updates condicionales de estado y emisión del QR protegida por
`UNIQUE(reserva_id)`. Reenviar el mismo evento N veces **no** duplica pagos,
confirmaciones ni boletos.

---

## 2. Contrato de API

### 2.1. Crear la reserva (hold temporal)

`POST /api/bookings` — requiere sesión (`Cliente`).

```jsonc
// request
{ "serviceId": 3, "startTime": "2026-10-15T15:00:00.000Z",
  "endTime": "2026-10-15T16:00:00.000Z", "cantidadCupos": 1 }
```

```jsonc
// 201 Created — la reserva nace en PENDIENTE_PAGO con TTL de 15 min
{ "success": true, "data": {
    "id": "<reserva-uuid>", "estado": "PENDIENTE_PAGO",
    "disponibilidadId": "…", "cantidadCupos": 1,
    "expiraEn": "2026-10-15T15:15:00.000Z", "total": "75000.00" } }
```

Errores relevantes: `409 CAPACITY_EXCEEDED` (sin cupos),
`409 SLOT_BLOCKED`, `409 SERVICE_UNAVAILABLE`, `400 INVALID_BOOKING_QUANTITY`,
`404 SLOT_NOT_FOUND`.

### 2.2. Webhook de Stripe

`POST /api/payments` (o el alias `POST /api/webhooks/stripe`). **No usa sesión**:
lo invoca Stripe con la cabecera `stripe-signature`.

Eventos manejados: `payment_intent.succeeded`, `payment_intent.payment_failed`.

```jsonc
// 200 — procesado (primera vez o reintento)
{ "success": true, "data": {
    "received": true,
    "pagoId": "…", "pagoCreado": true, "duplicado": false,
    "estado": "APROBADO",              // APROBADO | FALLIDO
    "reservaConfirmada": true,         // true solo en la corrida que confirma
    "reservaEstado": "CONFIRMADA",     // estado final de la reserva
    "ticketQrEmitido": true,           // true solo si esta corrida emitió el QR
    "franjaRestituida": false,         // true solo si esta corrida liberó la franja
    "membresiaActivada": false } }
```

```jsonc
// 200 — ignorado a propósito (Stripe deja de reintentar)
{ "success": true, "data": { "received": true, "ignored": true,
    "reason": "EVENT_TYPE_NOT_HANDLED" | "MISSING_METADATA" } }
```

```jsonc
// 400 MISSING_SIGNATURE | INVALID_SIGNATURE · 503 STRIPE_NOT_CONFIGURED · 500 SERVER_ERROR
```

> `duplicado: true` + `reservaConfirmada: false` + `ticketQrEmitido: false` en el
> segundo envío **es el comportamiento correcto**, no un error.

### 2.3. Leer estado + obtener el QR (comprobante)

`GET /api/pdf/receipt?reservaId=<uuid>&destinatario=PORTAL` — requiere sesión
(`Cliente` dueño de la reserva, o personal `POS`). Devuelve la estructura del
comprobante **ya resuelta** por el servidor (incluye el PNG del QR en base64):

```jsonc
{ "success": true, "data": {
    "reserva": { "id": "…", "estado": "CONFIRMADA", "total": "75000.00", /* … */ },
    "servicio": { "nombre": "…", "fecha": "2026-10-15", "horaInicio": "10:00:00",
                  "horaFin": "11:00:00", "ventana": { "inicio": "…", "fin": "…" } },
    "titular": { "id": "…", "nombre": "…", "correo": "…" },
    "ticket": { "id": "…", "estado": "EMITIDO", "emitidoEn": "…", "usadoEn": null },
    "qr": { "payload": "SC1:<ticketId>:<firma>", "dataUrl": "data:image/png;base64,…" } } }
```

- `ticket` y `qr` son `null` mientras no exista boleto (p. ej. reserva aún
  `PENDIENTE_PAGO`). Con el QR emitido, ambos llegan poblados.
- Errores: `401`, `403` (no es tu reserva), `404`, `409` (faltan relaciones),
  `503 QR_NOT_CONFIGURED`.

> `reserva.estado` de este endpoint es la forma más directa de **hacer polling**
> del resultado del webhook desde el portal.

### 2.4. Estados de la reserva que verá el Frontend

| Estado | Significado | Acción UI |
|--------|-------------|-----------|
| `PENDIENTE_PAGO` | Hold activo, esperando webhook | Mostrar "Procesando pago…" + countdown con `expiraEn` (15 min) |
| `CONFIRMADA` | Pago exitoso y QR emitido | Éxito: mostrar/descargar comprobante con QR |
| `CANCELADA_PAGO` | El pago falló: reserva cancelada y **franja liberada** | Error de pago: ofrecer reintentar reserva (nueva reserva) |
| `EXPIRADA` | El hold venció sin webhook (TTL) | El hold venció: ofrecer reintentar reserva |
| `CANCELADA_ADMINISTRATIVA` | Contingencia del servicio (TSK-BE-22) | Informar cancelación por el complejo |

---

## 3. Guía de implementación para Frontend

Punto de partida: `apps/web/src/app/(customer)/portal/book/page.tsx`
(hoy es un esqueleto con un `TODO`). Componentes/estilos: `@sportcomplex/ui`
(plantilla de comprobante `ticket-receipt`).

### 3.1. Flujo end-to-end

```
1. Seleccionar franja        → GET  /api/bookings?serviceId&date
2. Crear hold (15 min)       → POST /api/bookings                 → PENDIENTE_PAGO
3. Crear PaymentIntent       → POST /api/payments/intent          → client_secret  (⚠ ver §3.4)
4. Confirmar con Stripe      → <PaymentElement> confirmPayment()
5. Esperar el webhook        → polling a GET /api/pdf/receipt     → CONFIRMADA + QR
6. Mostrar comprobante+QR    → datos de /api/pdf/receipt → @sportcomplex/ui
```

### 3.2. Tipos TypeScript sugeridos

```ts
type EstadoReserva =
  | "PENDIENTE_PAGO" | "CONFIRMADA" | "CANCELADA_PAGO"
  | "EXPIRADA" | "CANCELADA_ADMINISTRATIVA";

interface HoldReserva {
  id: string; estado: EstadoReserva; cantidadCupos: number;
  expiraEn: string; total: string;
}

interface ComprobantePortal {
  reserva: { id: string; estado: EstadoReserva; total: string };
  ticket: { id: string; estado: "EMITIDO" | "USADO"; emitidoEn: string; usadoEn: string | null } | null;
  qr: { payload: string; dataUrl: string } | null;
  // …resto de campos del comprobante
}
```

### 3.3. Crear el hold y arrancar el countdown

```ts
const hold: HoldReserva = (await post("/api/bookings", {
  serviceId, startTime, endTime, cantidadCupos,
})).data;

const segundosRestantes = Math.max(
  0, Math.floor((new Date(hold.expiraEn).getTime() - Date.now()) / 1000),
);
// Pintar countdown; al llegar a 0 el estado pasará a EXPIRADA (lo decide el backend).
```

### 3.4. Checkout con Stripe Elements (⚠ dependencia pendiente)

La creación del `PaymentIntent` **todavía no existe**
(`POST /api/payments/intent` está fuera del alcance de TSK-BE-10; ver §6). Los
paquetes ya están instalados (`@stripe/stripe-js`, `@stripe/react-stripe-js`).
Cuando ese endpoint exista, **su respuesta debe traer `client_secret`** y el
PaymentIntent debe llevar los metadatos que el webhook consume:

```ts
// Metadatos OBLIGATORIOS del PaymentIntent (los define @sportcomplex/core)
metadata: { userId, bookingId, cashless: "true" }   // bookingId = hold.id
```

Sin `metadata.userId` + `bookingId` (o `membershipId`), el webhook responde
`200 ignored / MISSING_METADATA` y **la reserva nunca se confirma**.

### 3.5. Polling de confirmación (hasta que llegue el webhook)

```ts
async function esperarConfirmacion(reservaId: string) {
  const deadline = Date.now() + 15 * 60_000; // tope = TTL del hold
  while (Date.now() < deadline) {
    const { data } = await get(
      `/api/pdf/receipt?reservaId=${reservaId}&destinatario=PORTAL`,
    );
    switch (data.reserva.estado) {
      case "CONFIRMADA":         return { ok: true, comprobante: data };
      case "CANCELADA_PAGO":     return { ok: false, reason: "PAGO_FALLIDO" };
      case "EXPIRADA":           return { ok: false, reason: "HOLD_EXPIRADO" };
      // PENDIENTE_PAGO → seguir esperando
    }
    await new Promise((r) => setTimeout(r, 2500)); // ~2–3 s
  }
  return { ok: false, reason: "TIMEOUT" };
}
```

- El webhook suele llegar en **< 2 s**; usar intervalos de 2–3 s y detener el
  polling al llegar a `CONFIRMADA`, `CANCELADA_PAGO` o `EXPIRADA`.
- El estado **nunca** cambia por JS local: siempre lo fija el backend.

### 3.6. Mostrar el QR / comprobante

Al obtener `CONFIRMADA`, el comprobante ya trae `ticket` y `qr`:

```tsx
<img src={comprobante.qr!.dataUrl} alt="Código QR de acceso" />
<button onClick={() => printComprobante(comprobante)}>Descargar / Imprimir</button>
```

- `qr.dataUrl` es un PNG (`data:image/png;base64,…`) listo para mostrar/imprimir.
- El `qr.payload` (`SC1:<ticketId>:<firma>`) es lo que valida el lector en puerta
  (RN-05); no manipularlo.
- Mientras `ticket === null`, no hay QR que mostrar (la reserva aún no está
  confirmada).

### 3.7. Manejo de estados en la UI

| Resultado | UI |
|-----------|-----|
| `CONFIRMADA` | Pantalla de éxito + comprobante con QR |
| `CANCELADA_PAGO` | "No pudimos procesar el pago; la franja fue liberada." Botón **Reservar de nuevo** (crear nuevo hold) |
| `EXPIRADA` | "El tiempo para pagar venció; la franja se liberó." Botón **Reservar de nuevo** |
| `CANCELADA_ADMINISTRATIVA` | "La reserva fue cancelada por el complejo." |

### 3.8. Errores del webhook (integración)

| HTTP | `error.code` | Significado |
|------|--------------|-------------|
| 400 | `INVALID_SIGNATURE` / `MISSING_SIGNATURE` | Error de integración: no mostrar al usuario, loguear |
| 503 | `STRIPE_NOT_CONFIGURED` | Entorno sin claves: avisar al equipo |
| 500 | `SERVER_ERROR` | Transitorio: Stripe reintenta solo (idempotente) |

---

## 4. Nota de comportamiento (importante)

1. **El `payment_failed` cancela la reserva y libera la franja de inmediato.**
   Ante `payment_intent.payment_failed`, el backend transiciona la reserva
   `PENDIENTE_PAGO → CANCELADA_PAGO` y restituye los cupos. El estado deja de
   ser `PENDIENTE_PAGO` al instante (no hay que esperar los 15 min).

2. **El TTL de 15 min sigue siendo la red de seguridad.** Si un checkout se
   abandona y **no** llega ningún webhook, el job de expiración (TSK-BD-08) pasa
   la reserva a `EXPIRADA` y libera la franja. Ambos caminos usan updates
   condicionales, por lo que **nunca se liberan los cupos dos veces**.

3. **Un `succeeded` posterior sobre el MISMO PaymentIntent no resucita la
   reserva.** Si Stripe reenvía un `payment_intent.succeeded` después de un
   `payment_failed` (reintento del usuario sobre el mismo intent), la reserva ya
   está `CANCELADA_PAGO`: el pago queda registrado como `APROBADO`, pero la
   reserva **no** vuelve a `CONFIRMADA` y **no** se emite QR. Es consistente con
   el caso ya existente "success tardío tras TTL". Para soportar ese reintento
   habría que disparar la cancelación con `payment_intent.canceled` (evento
   definitivo) en lugar de `payment_failed`.

4. **El QR se emite exactamente una vez.** Solo la corrida que gana la
   confirmación (`reservaConfirmada: true`) crea el `TICKET_QR`; reenviar el
   webhook no duplica el boleto (`UNIQUE(reserva_id)`), por lo que el
   `ticketQrEmitido` del segundo envío es `false`.

5. **La alerta de pago fallido es no bloqueante.** El backend notifica a n8n en
   segundo plano; no revierte nada ni altera la respuesta a Stripe.

---

## 5. Cómo probarlo

```bash
# Unit + integración (mock de Prisma, sin BD real)
pnpm --filter @sportcomplex/db test     # incluye: emisión de QR y cancelación+restitución (TSK-BE-10)
pnpm --filter web test                  # webhook firmado + alias /api/webhooks/stripe

# End-to-end local con Stripe CLI
stripe listen --forward-to localhost:3000/api/payments
pnpm --filter web dev
stripe trigger payment_intent.succeeded          # reserva → CONFIRMADA + QR
stripe trigger payment_intent.payment_failed     # reserva → CANCELADA_PAGO + franja liberada
# Reenviar el mismo evento 2 veces: duplicado=true, sin duplicar pago/ticket.
```

---

## 6. Variables de entorno

```env
STRIPE_SECRET_KEY="sk_test_..."          # firma/consulta Stripe (obligatoria)
STRIPE_WEBHOOK_SECRET="whsec_..."        # verificación de stripe-signature (obligatoria)
QR_HMAC_SECRET="..."                     # firma del QR (GET /api/pdf/receipt)
N8N_CONTINGENCY_WEBHOOK_URL="..."        # alerta de pago fallido (opcional)
N8N_CONTINGENCY_HMAC_SECRET="..."        # firma de la alerta (opcional)
```

Sin `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET`, el webhook responde
`503 STRIPE_NOT_CONFIGURED`.

---

## 7. Pendientes / fuera de alcance

- **`POST /api/payments/intent`** (crear PaymentIntent + `client_secret`):
  vive en `feature/pos-stripe-cashless`. El checkout con Elements **depende** de
  que exista.
- **UI de checkout/POS con Stripe Elements**: tarea FE pendiente
  (`portal/book/page.tsx` y `(staff)/pos/page.tsx`).
- **Notificación al usuario** (email/push) al confirmar: flujo aparte (n8n).
