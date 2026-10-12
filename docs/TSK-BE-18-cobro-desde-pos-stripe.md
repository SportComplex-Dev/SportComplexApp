# TSK-BE-18: Cobro desde el POS con Stripe en tiempo real

- **Historia:** HU-18 (RF-17)
- **Fase:** F3
- **Estimación:** 3 puntos
- **Componente:** Backend
- **Dependencia:** TSK-BE-10

## Objetivo

Permitir que un empleado vendedor inicie desde el POS el cobro con tarjeta de
una reserva pendiente. El servidor calcula el importe y crea el `PaymentIntent`;
Stripe confirma el pago y el webhook firmado confirma la reserva, la emite y la
asocia al vendedor que atendió la venta.

La creación de reservas/holds desde el POS y la interfaz de Stripe Elements no
forman parte de esta tarea. El endpoint recibe una reserva pendiente existente.

## Flujo

1. `POST /api/payments/intent` requiere sesión con rol `Empleado_Vendedor` o
   `Administrador`. Recibe `{ "reservaId": "<uuid>" }`.
2. El servidor valida que la reserva exista, esté en `PENDIENTE_PAGO`, no haya
   vencido ni esté pagada, y que su servicio siga activo. Si ya está asociada a
   otro vendedor, rechaza la solicitud. Importe, titular y servicio se leen de
   la base de datos; no se aceptan del cliente.
3. El backend crea un `PaymentIntent` de tarjeta en COP, usando el empleado de
   la sesión como vendedor. La metadata es `bookingId`, `userId`, `servicio_id`,
   `vendedor_id` y `cashless`.
4. La respuesta incluye `client_secret`, `paymentIntentId`, `amount`, `currency`
   y `status`. El frontend POS confirma el pago con Stripe Elements.
5. `POST /api/payments` verifica `stripe-signature`. Ante
   `payment_intent.succeeded`, valida metadata de reserva, servicio y vendedor;
   en una transacción registra el pago, confirma la reserva, establece
   `vendedor_id` y `canal = TAQUILLA`, y emite el ticket QR. La respuesta local
   del POS nunca confirma la reserva por sí misma.

La creación del intent usa una clave de idempotencia derivada del ID de reserva.
La confirmación final y la emisión del QR conservan la idempotencia del webhook
implementada en TSK-BE-10 y TSK-BD-09.

## Contrato del endpoint

### Solicitud

```http
POST /api/payments/intent
Content-Type: application/json
```

```json
{ "reservaId": "<uuid>" }
```

### Respuesta exitosa (`201`)

```json
{
  "success": true,
  "data": {
    "reservaId": "<uuid>",
    "paymentIntentId": "pi_...",
    "client_secret": "pi_..._secret_...",
    "amount": 7500000,
    "currency": "cop",
    "status": "requires_payment_method"
  }
}
```

El importe `amount` está expresado en la unidad menor que espera Stripe. El
servidor deriva el total de `RESERVA.total`.

### Errores relevantes

| HTTP | Código | Motivo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | El cuerpo no tiene un `reservaId` UUID válido. |
| 401 / 403 | autenticación / `POS_BOOKING_FORBIDDEN` | Sesión o rol inválido, o la reserva ya pertenece a otro vendedor. |
| 404 | `BOOKING_NOT_FOUND` | Reserva inexistente. |
| 409 | `BOOKING_NOT_PAYABLE` / `SERVICE_UNAVAILABLE` / `POS_PAYMENT_INTENT_CONFLICT` | Reserva vencida/no pendiente/pagada, servicio inactivo o intent previo de otra venta. |
| 422 | `INVALID_RESERVATION_TOTAL` | El total no puede convertirse a importe de Stripe. |
| 502 / 503 | `PAYMENT_INTENT_FAILED` / `STRIPE_NOT_CONFIGURED` | Error de Stripe o falta configuración. |

## Persistencia y base de datos

Esta tarea **sí modifica explícitamente la lógica de persistencia** en
`packages/db/src/repositories/payments.ts`: cuando el webhook acepta el pago,
actualiza `RESERVA.vendedor_id` con el empleado del POS y `RESERVA.canal` con
`TAQUILLA`, además de confirmar la reserva y asociar el pago.

No se modificó `schema.prisma` ni se creó una migración. Las columnas
`RESERVA.vendedor_id` y `RESERVA.canal` ya existen en el esquema y en la
migración inicial.

## Configuración y alcance relacionado

Se reutilizan `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, ya descritas en
`apps/web/.env.example`. La interfaz POS con Stripe Elements corresponde al
frontend. La confirmación, el QR y la idempotencia del webhook se apoyan en
[`TSK-BE-10`](TSK-BE-10-webhook-stripe-y-frontend.md) y
[`TSK-BD-09`](TSK-BD-09-idempotencia-pagos-stripe.md).
