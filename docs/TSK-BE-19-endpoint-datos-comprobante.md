# TSK-BE-19 — Endpoint de datos del comprobante

`GET /api/pdf/receipt?reservaId=<uuid>&destinatario=PORTAL|POS`

Devuelve la **estructura de datos** del comprobante (membrete, reserva, servicio, titular y QR) resuelta en el servidor. El navegador solo maqueta con la plantilla `ticket-receipt` de `@sportcomplex/ui` y la entrega al diálogo de impresión de PDF (RN-14 / RNF-05); el endpoint no devuelve PDF binario.

## Criterio de aceptación

> el PDF se genera con datos obtenidos del servidor; ninguna clave de Stripe ni de base de datos llega al bundle del navegador.

Todo se arma en el servidor, incluida la firma HMAC del QR y la imagen PNG:

- La lectura de datos es `getReceiptReserva` (`packages/db/src/repositories/receipts.ts`) con `select` explícito: **no** incluye `pago` ni `membresia`, así que `stripe_payment_intent_id` y `pagoId` nunca salen del backend.
- El QR se firma con `QR_HMAC_SECRET` en `apps/web/src/lib/receipt.ts` y se entrega ya firmado (`payload`) y rasterizado (`dataUrl`, generado con `qrcode` en el servidor). El secreto no aparece en ninguna rama de la respuesta.
- El membrete viene de variables de entorno (`RECEIPT_*`), no de la base de datos ni de cabeceras del navegador.
- La respuesta se marca `Cache-Control: no-store` (el estado del boleto puede cambiar).
- La prueba `TSK-BE-19 (CRITERIO)` serializa la respuesta y falla si aparece el secreto QR, una clave `sk_test/sk_live`, un `postgresql://`, un `service role` o cualquier `pagoId`.

## Autorización

- Requiere sesión activa; sin sesión `401 UNAUTHORIZED`, con cuenta no activa `403 FORBIDDEN`.
- Un **cliente** solo descarga comprobantes de reservas cuyo `titularId` es su usuario; una reserva ajena responde `403 RECEIPT_FORBIDDEN` (mismo criterio de aislamiento que TSK-BE-13).
- **Vendedor** y **administrador** pueden emitir el comprobante de cualquier reserva (`destinatario=POS`, RF-17). Un cliente no puede estampar `POS`: aunque sea su reserva, el comprobante de taquilla lo emite el personal.
- Un `reservaId` inexistente responde `404 RECEIPT_NOT_FOUND`; si a la reserva le faltan relaciones, `409 RECEIPT_INCOMPLETE`.

## Contenido del QR

`SC1:<ticket_qr.codigo_uuid>:<firma HMAC-SHA256>`

El par viaja junto en el QR porque el lector (RF-13) lee una sola vez; `parseTicketQrPayload` lo separa en `@sportcomplex/core` y `verifyTicketSignature` lo valida **antes** de tocar la base de datos (ARCHITECTURE §8.2). Si la reserva todavía no tiene boleto emitido, `ticket` y `qr` llegan en `null` — la emisión del boleto pertenece al flujo de pago (RN-05), no a este endpoint.

## Variables de entorno

`QR_HMAC_SECRET` (obligatoria) y, opcionalmente, `RECEIPT_ENTIDAD`, `RECEIPT_NIT`, `RECEIPT_DIRECCION`, `RECEIPT_TELEFONO`, `RECEIPT_CORREO`, `RECEIPT_PIE`.

## Pruebas

- `packages/core/src/security/qr.test.ts` — ida y vuelta del payload y rechazo de contenido manipulado.
- `apps/web/src/app/api/pdf/receipt/__tests__/receipt.test.ts` — forma de la respuesta, verificación de la firma, aislamiento por titular, acceso de taquilla, 404 y el criterio de no filtración.

No se modificó el esquema ni se creó/aplicó una migración.

## Contrato del endpoint

```jsonc
// GET /api/pdf/receipt?reservaId=60dbc084-…&destinatario=PORTAL|POS
{ "success": true, "data": {
    "membrete": { "entidad", "nit", "direccion", "telefono", "correo", "pie" },  // null si no se configura
    "emision":  { "documento": "COMPROBANTE_DE_RESERVA", "generadoEn", "zonaHoraria": "America/Bogota",
                  "moneda": "COP", "destinatario": "PORTAL" | "POS" },
    "reserva":  { "id", "estado", "canal", "cantidadCupos", "creadaEn", "subtotal", "descuentoPct", "total" },
    "servicio": { "id", "nombre", "modalidad", "fecha": "2026-10-08",
                  "horaInicio": "20:30:00", "horaFin": "22:00:00",
                  "ventana": { "inicio": "2026-10-09T01:30:00.000Z", "fin": "…" } },
    "titular":  { "id", "nombre", "correo" },
    "ticket":   { "id", "estado": "EMITIDO" | "USADO", "emitidoEn", "usadoEn" },  // null sin boleto
    "qr":       { "payload": "SC1:<uuid>:<firma>", "dataUrl": "data:image/png;base64,…" }  // null sin boleto
}, "timestamp": "…" }
```

Montos en string con dos decimales (`"60000.00"`). `ventana` son instantes ISO; `fecha`/`hora*` son hora local de Bogotá (offset `-05:00`, mismo criterio que el módulo de reservas).

Errores: `400 VALIDATION_ERROR` · `401 UNAUTHORIZED` · `403 FORBIDDEN | RECEIPT_FORBIDDEN` · `404 RECEIPT_NOT_FOUND` · `409 RECEIPT_INCOMPLETE` · `503 QR_NOT_CONFIGURED` · `500 SERVER_ERROR`.

## QA manual

```bash
pnpm install && pnpm --filter @sportcomplex/db db:generate
pnpm --filter web dev

curl "http://localhost:3000/api/pdf/receipt?reservaId=<uuid>&destinatario=PORTAL" \
  -H "Cookie: authjs.session-token=<sesión del titular>"
```

Checklist:

1. Titular → `200` con membrete, reserva, servicio, titular y `qr.payload` + `qr.dataUrl`.
2. Abrir `qr.dataUrl` en el móvil: debe leerse como QR y devolver `SC1:<uuid>:<firma>`.
3. Otro cliente sobre esa misma reserva → `403 RECEIPT_FORBIDDEN`.
4. Vendedor con `destinatario=POS` → `200`; el mismo cliente con `POS` → `403`.
5. Cuenta no activa → `403 FORBIDDEN`; `reservaId` inexistente → `404`.
6. `curl -i` → `Cache-Control: no-store`.
7. `grep` del cuerpo: sin `sk_`, `postgresql://`, `pagoId` ni secretos.

## Fuera de alcance (no marcar)

- UI que consuma el endpoint (botón "descargar comprobante" en `/portal` y `/pos`) → otra task.
- Cablear `/scanner` con `parseTicketQrPayload` + `POST /api/access`: la función ya existe y está probada, pero hoy ningún lector la invoca.
- Emisión del boleto (`ticket_qr`) cuando el pago no lo crea: si no hay boleto, `ticket` y `qr` salen en `null` (RN-05 es del flujo de pago).

## Para quien docketice en Jira (copiar/pegar)

- **Rama:** `feature/tsk-be-19-endpoint-de-datos-del-comprobante` → `develop`
- **Estado:** En Desarrollo → Resuelto al merge
- **Task:** TSK-BE-19 (Endpoint de datos del comprobante · HU-19 / RF-17 / RNF-05 · 1 pt) — depende de TSK-BE-13
- **Jira:** SCRUM-135
- **PR:** [#30](https://github.com/SportComplex-Dev/SportComplexApp/pull/30) hacia `develop`
- **Commits:** `f699749` (feat: endpoint de datos del comprobante) + merge de `develop`
- **Docs:** este archivo