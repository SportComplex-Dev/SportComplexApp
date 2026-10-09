# TSK-BE-23 — Endpoints de consulta para el chatbot

## Autenticación

Las dos rutas requieren la cabecera `x-api-key`, comparada contra `BOT_API_KEY`.
La variable debe configurarse en cada entorno; si falta, las rutas responden
`503` y no se degradan a acceso público. Una clave ausente o incorrecta recibe
`401`.

## Disponibilidad

`GET /api/v1/bot/availability?serviceId=<id>&date=YYYY-MM-DD` devuelve las franjas
futuras de un servicio activo con cupos ocupados, libres y bloqueo de
mantenimiento. Los holds pendientes vencidos se descuentan para informar cupos
vigentes, sin expirar reservas ni actualizar contadores.

## Validación de ticket

`GET /api/v1/bot/validate-ticket?ticketId=<uuid>&signature=<hmac-sha256-hex>`
verifica la firma QR antes de consultar la base de datos. Responde el estado,
servicio y franja del ticket; `valido` indica si está emitido y dentro de su
ventana de acceso. Un ticket existente pero usado o fuera de su ventana se
responde exitosamente con `valido: false`.

La ruta es estrictamente de consulta: no crea auditorías ni modifica el estado
del ticket. El canje permanece exclusivo del flujo de escaneo autorizado.

Las respuestas usan el formato canónico `{ success, data, timestamp }`; los
errores siguen `{ success: false, error, timestamp }`.
