================================================================================
README: TSK-AU-01 — Flujo n8n de Envío del Código de Verificación
Componente: Automation & n8n | Proyecto: SportComplex (AKROS Club)
Historia de Usuario: HU-03 (RF-02) | Dependencia Backend: TSK-BE-03
Rama Sugerida: feature/tsk-au-01-flujo-n8n-de-envio-del
================================================================================

1. DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
Este workflow automatiza el envío del código OTP de autenticación cuando un 
usuario crea una cuenta en la plataforma y queda en estado 'Pendiente' (TSK-BE-03).

El flujo es activado mediante Webhook desde el backend, formatea una plantilla
HTML institucional con la marca de AKROS Club, inyecta el código generado junto
con su tiempo de caducidad, y lo despacha de forma prioritaria a través de la API
de Resend, incorporando reintentos automáticos para garantizar alta disponibilidad.

- Tarea Jira: TSK-AU-01 (SCRUM-96)
- Historia de Usuario: HU-03 (RF-02)
- Fase: F2 | Story Points: 3 pts
- Responsable: Juan Bolivar
- SLA / Criterio de Aceptación: Correo entregado con el código correcto en menos
  de 60 segundos; no expone credenciales críticas en logs.


2. ESPECIFICACIÓN DEL WEBHOOK (ENDPOINT)
--------------------------------------------------------------------------------
- Método HTTP: POST
- Path configurado: auth/enviar-codigo
- Authentication: None
- Respond Mode: Using 'Respond to Webhook' Node

- Endpoint Producción:
  https://jafet123.app.n8n.cloud/webhook/auth/enviar-codigo

- Endpoint Sandbox / Pruebas:
  https://jafet123.app.n8n.cloud/webhook-test/auth/enviar-codigo

- Encabezados Requeridos (Headers):
  Content-Type: application/json


3. VARIABLES DE ENTORNO EN EL BACKEND (.env)
--------------------------------------------------------------------------------
# Integración n8n - Código de Verificación OTP (TSK-AU-01)
N8N_AUTH_CODE_WEBHOOK_URL="https://jafet123.app.n8n.cloud/webhook/auth/enviar-codigo"


4. CONTRATO DE DATOS (PAYLOAD ENTRANTE - REQUEST BODY)
--------------------------------------------------------------------------------
{
  "usuarioId": 45,
  "nombre": "Juan Bolívar",
  "correo": "jebolivar33@gmail.com",
  "codigoVerificacion": "849201",
  "expiraEnMinutos": 15
}


5. RESPUESTA SÍNCRONA DEL WEBHOOK
--------------------------------------------------------------------------------
HTTP 200 OK
{
  "ok": true,
  "mensaje": "Código de verificación despachado exitosamente"
}


6. ARQUITECTURA DE NODOS EN N8N
--------------------------------------------------------------------------------
[Webhook]
    │  (POST /auth/enviar-codigo | responseMode: 'responseNode')
    ▼
[Code in JavaScript]
    │  - Extrae y mapea destinatario, nombre, código, expiraEnMinutos y usuarioId.
    │  - Compila la plantilla responsiva institucional HTML:
    │     * Encabezado 'Verifica tu cuenta'.
    │     * Caja contenedora de alta visibilidad para el código (code-box).
    │     * Aviso de vigencia límite en minutos.
    │     * Pie de firma institucional de Complejo Deportivo 2026.
    │  - Genera el asunto: "${codigo} es tu código de verificación".
    ▼
[HTTP Request (POST a Resend)]
    │  - URL: https://api.resend.com/emails
    │  - Headers:
    │     * Content-Type: application/json
    │     * Authorization: Bearer <RESEND_API_KEY>
    │  - Body:
    │     {
    │       "from": "Akros <no-reply@akros.lat>",
    │       "to": [destinatario],
    │       "subject": asunto,
    │       "html": htmlTemplate
    │     }
    │  - Políticas de Resiliencia: retryOnFail=true, waitBetweenTries=2000 ms.
    ▼
[Respond to Webhook]
       - Retorna HTTP 200 OK confirmando la entrega del mensaje.


7. PRUEBA DE INTEGRACIÓN VÍA CURL (CLI)
--------------------------------------------------------------------------------
curl -i -X POST https://jafet123.app.n8n.cloud/webhook-test/auth/enviar-codigo \
  -H "Content-Type: application/json" \
  -d '{
    "usuarioId": 1,
    "nombre": "Juan Esteban",
    "correo": "jebolivar33@gmail.com",
    "codigoVerificacion": "739201",
    "expiraEnMinutos": 15
  }'
================================================================================