================================================================================
README: TSK-AU-05 — Notificación por Contingencia Operativa de Servicios
Componente: Automation & n8n | Proyecto: SportComplex (AKROS Club)
Rama de Integración: feature/n8n-workflows-au-03-05-07
================================================================================

1. DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
Este workflow automatiza la recepción de incidentes administrativos cuando un
servicio, cancha o instalación es inhabilitado por contingencia o fuerza mayor
desde el panel administrativo (TSK-BE-22).

El flujo valida la autenticidad del origen mediante verificación criptográfica
HMAC-SHA256, responde de forma síncrona en <50 ms para liberar al backend y
evitar caídas por timeout (SLA < 2.5s), y procesa asíncronamente en segundo plano
el despacho masivo de correos individuales con plantilla HTML Dark Mode a cada
uno de los usuarios con reservas afectadas a través de la API de Resend.

- Identificador Jira: TSK-AU-05 (SCRUM-118)
- Tarea Backend Asociada: TSK-BE-22 (Admin Incident Contingency Endpoint)
- Fase del Proyecto: F2
- Criterio de Aceptación / SLA: Respuesta síncrona en <2.5 s y notificación por
  correo a la totalidad de los usuarios afectados sin bloquear el servidor.


2. ESPECIFICACIÓN DEL WEBHOOK (ENDPOINT)
--------------------------------------------------------------------------------
- Método HTTP: POST
- Endpoint Producción:
  https://onebolivar.app.n8n.cloud/webhook/contingencias/servicio

- Endpoint Sandbox / Pruebas:
  https://onebolivar.app.n8n.cloud/webhook-test/contingencias/servicio

- Encabezados Requeridos (Headers):
  * Content-Type: application/json
  * X-SportComplex-Signature: sha256=<hex_hmac_sha256>

- Configuración del Nodo en n8n:
  * responseMode: "responseNode" (Responde mediante nodos explícitos)
  * rawBody: true (Conserva el cuerpo binario/crudo para cálculo exacto de HMAC)


3. VARIABLES DE ENTORNO EN EL BACKEND (.env)
--------------------------------------------------------------------------------
# Integración n8n - Contingencias Operativas (TSK-AU-05 / TSK-BE-22)
N8N_CONTINGENCY_WEBHOOK_URL="https://onebolivar.app.n8n.cloud/webhook/contingencias/servicio"
N8N_CONTINGENCY_HMAC_SECRET="akros_super_secret_contingency_key_32chars_min"


4. CONTRATO DE DATOS (PAYLOAD ENTRANTE - REQUEST BODY)
--------------------------------------------------------------------------------
{
  "serviceId": 1,
  "motivo": "Falla imprevista en fluido electrico",
  "servicioNombre": "Cancha Sintetica Principal Futbol 7",
  "afectados": [
    {
      "nombreUsuario": "Juan Esteban",
      "emailUsuario": "cliente@ejemplo.com",
      "codigoReserva": "RES-AKROS-789",
      "fecha": "2026-10-09",
      "horario": "18:00 - 19:00"
    }
  ]
}

* Nota de compatibilidad: Soporta indistintamente arreglos bajo la clave
  "afectados" o "reservasAfectadas", y mapea propiedades tanto en formato
  "emailUsuario"/"nombreUsuario" como "email"/"nombre".


5. RESPUESTAS HTTP SÍNCRONAS DEL WEBHOOK
--------------------------------------------------------------------------------
A. Éxito de Validación y Encolamiento (HTTP 200 OK):
{
  "ok": true,
  "mensaje": "Contingencia recibida en n8n, procesando notificaciones"
}

B. Firma HMAC Ausente o Inválida (HTTP 401 Unauthorized):
{
  "ok": false,
  "mensaje": "Firma HMAC inválida o no proporcionada"
}


6. ARQUITECTURA DE NODOS EN N8N
--------------------------------------------------------------------------------
[Webhook] (POST /contingencias/servicio | rawBody: true)
    │
    ▼
[Validar Firma HMAC] (Code Node)
    │  - Lee header 'x-sportcomplex-signature' (sha256=<hex>).
    │  - Computa hash HMAC-SHA256 sobre el rawBody con el secreto compartido.
    │  - Ejecuta crypto.timingSafeEqual para prevenir timing attacks.
    │  - Emite { isValid: boolean, payload: object }.
    ▼
[¿Firma Válida?] (IF Node)
    ├── FALSE ──► [Respond to Webhook (401)]
    │             - Retorna HTTP 401 Unauthorized inmediatamente.
    │             - Aborta la ejecución sin tocar Resend ni gastar cuota.
    │
    └── TRUE  ──► [Respond to Webhook (200)]
                  │  - Retorna HTTP 200 OK síncrono al backend en <50 ms.
                  │  - Garantiza el cumplimiento del timeout de 2.5s.
                  ▼
          [Preparar Correos Individuales] (Code Node)
                  │  - Itera sobre el arreglo de clientes afectados.
                  │  - Construye plantilla responsiva HTML Dark Mode.
                  │  - Incorpora política operativa: sin reembolso bancario
                  │    automático, saldo a favor y reprogramación en sede.
                  │  - Emite resendPayload individual para cada destinatario.
                  ▼
          [Enviar Correo Resend] (HTTP Request Node)
                  - POST a https://api.resend.com/emails
                  - Rate limiting: Lotes de 1 ítem con intervalo de 600 ms.
                  - onError: continueRegularOutput para resiliencia en cola.


7. PRUEBAS DE INTEGRACIÓN VÍA CURL (CLI)
--------------------------------------------------------------------------------
A. Simulación de Petición Válida (200 OK):
curl -i -X POST https://onebolivar.app.n8n.cloud/webhook-test/contingencias/servicio \
  -H "Content-Type: application/json" \
  -H "X-SportComplex-Signature: sha256=fdcc234db60b7da9b32f881fc7f66c6958ea9d325443eed7f5b42fae5dd8f7be" \
  -d '{"serviceId":1,"motivo":"Falla imprevista en fluido electrico","servicioNombre":"Cancha Sintetica Principal Futbol 7","afectados":[{"nombreUsuario":"Juan Esteban","emailUsuario":"jebolivar33@gmail.com","codigoReserva":"RES-AKROS-789","fecha":"2026-10-09","horario":"18:00 - 19:00"}]}'

B. Simulación de Rechazo por Firma Inválida (401 Unauthorized):
curl -i -X POST https://onebolivar.app.n8n.cloud/webhook-test/contingencias/servicio \
  -H "Content-Type: application/json" \
  -H "X-SportComplex-Signature: sha256=0000000000000000000000000000000000000000000000000000000000000000" \
  -d '{"serviceId":1,"motivo":"Falla imprevista en fluido electrico","servicioNombre":"Cancha Sintetica Principal Futbol 7","afectados":[{"nombreUsuario":"Juan Esteban","emailUsuario":"jebolivar33@gmail.com","codigoReserva":"RES-AKROS-789","fecha":"2026-10-09","horario":"18:00 - 19:00"}]}'
================================================================================