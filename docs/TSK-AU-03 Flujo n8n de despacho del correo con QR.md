================================================================================
README: TSK-AU-03 — Flujo n8n de Despacho de Correo con QR y Acceso al Portal
Componente: Automation & n8n | Proyecto: SportComplex (AKROS Club)
Rama de Integración: feature/n8n-workflows-au-03-05-07
================================================================================

1. DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
Este workflow automatiza la notificación inmediata al usuario cuando una reserva
es confirmada y pagada en el backend (TSK-BE-10).

El flujo recibe el evento vía Webhook, estructura la información de la reserva,
genera y vincula el código QR de acceso (o token criptográfico de boletería),
construye una plantilla HTML responsiva con el enlace directo al portal y
despacha el correo electrónico mediante la API de Resend.

- Identificador Jira: TSK-AU-03 (SCRUM-116)
- Historia de Usuario: HU-11 (RF-10)
- Fase del Proyecto: F2
- Criterio de Aceptación / SLA: El comprador recibe el correo con el código QR en
  menos de 60 segundos y puede acceder a su boleto digital en el portal.


2. ESPECIFICACIÓN DEL WEBHOOK (ENDPOINT)
--------------------------------------------------------------------------------
- Método HTTP: POST
- Path configurado: reservas/despacho-qr
- Authentication: None
- Respond Mode: Using 'Respond to Webhook' Node

- Endpoint Producción:
  https://onebolivar.app.n8n.cloud/webhook/reservas/despacho-qr

- Endpoint Sandbox / Pruebas:
  https://onebolivar.app.n8n.cloud/webhook-test/reservas/despacho-qr

- Encabezados Requeridos (Headers):
  Content-Type: application/json


3. VARIABLES DE ENTORNO EN EL BACKEND (.env)
--------------------------------------------------------------------------------
# Integración n8n - Despacho de Código QR (TSK-AU-03)
N8N_RESERVATION_QR_WEBHOOK_URL="https://onebolivar.app.n8n.cloud/webhook/reservas/despacho-qr"
NEXT_PUBLIC_APP_URL="https://akros.lat"


4. CONTRATO DE DATOS (PAYLOAD ENTRANTE - REQUEST BODY)
--------------------------------------------------------------------------------
{
  "reservaId": "RES-AKROS-1024",
  "codigoAccesoQR": "AKROS-SECURE-TOKEN-UUID-O-JWT",
  "qrImageUrl": "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=AKROS-SECURE-TOKEN-UUID-O-JWT",
  "usuario": {
    "nombre": "Juan Esteban Bolívar",
    "email": "jebolivar33@gmail.com"
  },
  "detalle": {
    "servicioNombre": "Cancha Sintética Principal Fútbol 7",
    "fecha": "2026-10-15",
    "horario": "19:00 - 20:00",
    "precioTotal": "$80.000 COP",
    "portalUrl": "https://akros.lat/portal/reservas/RES-AKROS-1024"
  }
}


5. RESPUESTA SÍNCRONA DEL WEBHOOK
--------------------------------------------------------------------------------
HTTP 200 OK
{
  "ok": true,
  "mensaje": "Confirmación de reserva recibida en n8n, despachando QR por correo"
}


6. ARQUITECTURA DE NODOS EN N8N
--------------------------------------------------------------------------------
[Webhook]
    │  (POST /webhook/reservas/despacho-qr | Respond: 'Respond to Webhook' Node)
    ▼
[Code in JavaScript / Preparar Datos y Template]
    │  - Normaliza los datos de la reserva y el cliente.
    │  - Ensambla la plantilla HTML Dark Mode con estilos en línea:
    │     * Resumen de reserva (Fecha, Horario, Cancha, Monto).
    │     * Imagen incrustada del QR (<img src="${qrImageUrl}">).
    │     * Botón de acción directo al boleto en el portal (${portalUrl}).
    │  - Prepara el objeto de carga útil para Resend.
    ▼
[HTTP Request (POST a Resend)]
    │  - URL: https://api.resend.com/emails
    │  - Headers:
    │     * Content-Type: application/json
    │     * Authorization: Bearer <RESEND_API_KEY>
    │  - Estructura de despacho:
    │     {
    │       "from": "Akros Alertas <no-reply@akros.lat>",
    │       "to": ["jebolivar33@gmail.com"],
    │       "subject": "Tu Reserva está Confirmada - Código QR de Entrada (RES-AKROS-1024)",
    │       "html": "<...template_html...>"
    │     }
    ▼
[Respond to Webhook]
       - Retorna 200 OK confirmando el procesamiento exitoso.


7. PRUEBA DE INTEGRACIÓN VÍA CURL (CLI)
--------------------------------------------------------------------------------
curl -i -X POST https://onebolivar.app.n8n.cloud/webhook-test/reservas/despacho-qr \
  -H "Content-Type: application/json" \
  -d '{
    "reservaId": "RES-AKROS-1024",
    "codigoAccesoQR": "AKROS-QR-VERIFICATION-TOKEN-TEST",
    "qrImageUrl": "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=AKROS-QR-VERIFICATION-TOKEN-TEST",
    "usuario": {
      "nombre": "Juan Esteban",
      "email": "jebolivar33@gmail.com"
    },
    "detalle": {
      "servicioNombre": "Cancha Sintética Principal Fútbol 7",
      "fecha": "2026-10-15",
      "horario": "19:00 - 20:00",
      "precioTotal": "$80.000 COP",
      "portalUrl": "https://akros.lat/portal/reservas/RES-AKROS-1024"
    }
  }'
================================================================================