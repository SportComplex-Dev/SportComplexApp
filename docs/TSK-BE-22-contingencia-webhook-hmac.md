# TSK-BE-22 — Inhabilitación por contingencia y webhook n8n

## Endpoint y transacción

`POST /api/admin/incident` requiere ADMIN y recibe `{ "serviceId": 1, "motivo": "..." }`.

En una transacción se bloquean las disponibilidades del servicio, se crea el registro de inhabilitación, el servicio pasa a `INHABILITADO`, las reservas `PENDIENTE_PAGO` y `CONFIRMADA` pasan a `CANCELADA_ADMINISTRATIVA`, y se liberan sus cupos. Reservas, pagos, usuarios e historial de escaneos se conservan. No se inicia reembolso bancario.

## n8n y firma

Después del commit se envía un POST con el servicio, motivo y reservas/usuarios/horarios afectados. El encabezado `X-SportComplex-Signature` contiene `sha256=<hex>` calculado como HMAC-SHA-256 del cuerpo JSON exacto.

Configurar `N8N_CONTINGENCY_WEBHOOK_URL` y `N8N_CONTINGENCY_HMAC_SECRET` (mínimo 32 caracteres aleatorios) en el entorno del servidor; no guardar secretos reales en el repositorio. El timeout es 2.5 segundos. Respuesta HTTP no exitosa, configuración incompleta o fallo de red se informa como `webhook.sent = false` y se registra, pero no revierte el bloqueo ni las cancelaciones. `webhookEnviadoEn` se actualiza solo tras una respuesta exitosa de n8n. Si n8n respondió exitosamente pero falla la actualización de `webhookEnviadoEn`, la API registra el error y mantiene la respuesta exitosa de la contingencia con `webhookEnviadoRegistrado = false`; no se reintenta automáticamente el webhook.

No se modificó el esquema ni se creó/aplicó una migración. `pnpm --filter web test` incluye las pruebas del webhook y la ruta de contingencia: autorización (401/403), validación (400), respuesta cuando n8n falla y fallo al registrar el despacho. Las pruebas de DB cubren cancelación/liberación de cupos, prevención de doble inhabilitación y conservación de pagos.
