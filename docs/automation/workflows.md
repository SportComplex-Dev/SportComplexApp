# Documentación de Workflows n8n - Complejo Deportivo
> Estado: vigente 2026-10-15

## Descripción General

Este documento describe los workflows automáticos implementados en n8n para el Complejo Deportivo. Los workflows manejan procesos automatizados de comunicación, validación y notificaciones.

---

## Workflows Disponibles

### 1. **envio-codigo-verificacion-otp** - Envío de Código de Verificación

#### Propósito
Automatizar el envío de códigos de verificación por correo electrónico durante el proceso de registro o verificación de dos factores.

#### Tipo de Disparador
- **Webhook HTTP POST**
- Ruta: `/auth/enviar-codigo`
- Método: `POST`
- Modo de respuesta: Nodo de respuesta

#### Entrada Esperada
El webhook espera un payload JSON con la siguiente estructura:

```json
{
  "correo": "usuario@ejemplo.com",
  "nombre": "Juan Pérez",
  "codigoVerificacion": "123456",
  "expiraEnMinutos": 15,
  "usuarioId": "user-id-123"
}
```

**Campos requeridos:**
- `correo` (string): Dirección de correo electrónico del destinatario
- `nombre` (string, opcional): Nombre del usuario (default: "Usuario")
- `codigoVerificacion` (string): Código de 6 dígitos para verificación
- `expiraEnMinutos` (number, opcional): Tiempo de expiración del código (default: 15)
- `usuarioId` (string): Identificador único del usuario

#### Nodos del Workflow

##### 1. **Webhook** (2131c13a-717e-4868-94cf-fca1861c0272)
- **Tipo**: n8n-nodes-base.webhook v2.1
- **Función**: Recibe solicitudes POST y activa el workflow
- **Configuración**:
  - Método HTTP: POST
  - Ruta: `auth/enviar-codigo`
  - Respuesta: Nodo de respuesta

##### 2. **Code in JavaScript** (0b156b44-2543-40a3-b6c8-7307a87dc3d9)
- **Tipo**: n8n-nodes-base.code v2
- **Función**: Construye el email HTML y prepara datos para envío
- **Lógica**:
  - Extrae datos del body del webhook
  - Genera template HTML personalizado con estilos
  - Estructura el payload para Resend API
  - Incluye seguridad con fallbacks para valores opcionales

**Output:**
```json
{
  "destinatario": "usuario@ejemplo.com",
  "asunto": "123456 es tu código de verificación",
  "html": "<html>...template con código...</html>",
  "usuarioId": "user-id-123"
}
```

##### 3. **HTTP Request** (f4bfe480-ba16-4645-8578-6226b713427c)
- **Tipo**: n8n-nodes-base.httpRequest v4.5
- **Función**: Envía el email a través de Resend API
- **Configuración**:
  - URL: `https://api.resend.com/emails`
  - Método: POST
  - Reintentos: Habilitado (2 segundos entre intentos)
  - Headers:
    - `Content-Type`: `application/json`
    - `Authorization`: `Bearer ${RESEND_API_KEY}` (configurar en n8n)
  - Remitente: `Akros <no-reply@akros.lat>`

**Payload enviado:**
```json
{
  "from": "Akros <no-reply@akros.lat>",
  "to": ["usuario@ejemplo.com"],
  "subject": "123456 es tu código de verificación",
  "html": "<html>...contenido...</html>"
}
```

##### 4. **Respond to Webhook** (0a7bfe68-a582-402d-ac53-018837d5e830)
- **Tipo**: n8n-nodes-base.respondToWebhook v1.5
- **Función**: Responde al cliente con confirmación
- **Respuesta**:
  - Status Code: 200
  - Body:
    ```json
    {
      "ok": true,
      "mensaje": "Código de verificación despachado exitosamente"
    }
    ```

#### Flujo de Conexiones

```
Webhook 
  ↓
Code in JavaScript 
  ↓
HTTP Request (Resend API) 
  ↓
Respond to Webhook
```

#### Ejemplo de Uso

**Request (cURL):**
```bash
curl -X POST https://tu-n8n-url/webhook/auth/enviar-codigo \
  -H "Content-Type: application/json" \
  -d '{
    "correo": "usuario@ejemplo.com",
    "nombre": "Juan Pérez",
    "codigoVerificacion": "987654",
    "expiraEnMinutos": 15,
    "usuarioId": "usr-abc123"
  }'
```

**Response exitosa (200):**
```json
{
  "ok": true,
  "mensaje": "Código de verificación despachado exitosamente"
}
```

#### Template de Email

El workflow genera un email con:
- Estilo responsive profesional
- Código de verificación destacado en tipografía grande
- Tiempo de expiración visible
- Branding del Complejo Deportivo
- Footer con derechos de autor

**Color scheme:**
- Fondo: `#f4f4f7` (gris claro)
- Tarjeta: `#ffffff` (blanco)
- Código: Fondo `#0f172a` (azul oscuro), Texto `#38bdf8` (cian)
- Texto principal: `#334155` (gris oscuro)
- Texto secundario: `#64748b` (gris)

#### Variables de Entorno

Necesarias en la instancia n8n:
- `RESEND_API_KEY`: API key de Resend (actualmente hardcodeada)
- Considerar migrar a variables de entorno para seguridad

#### Monitoreo y Logs

- Revisar logs en n8n para errores de envío
- Validar que el código se genere correctamente
- Monitorear tasa de entrega en Resend dashboard
- Alertar si los reintentos fallan después de 2 intentos

#### Mantenimiento

- **Actualizar código**: Si cambios en estructura de email
- **Rotar API Keys**: Regularmente la clave de Resend
- **Validar emails**: Confirmar que llegan en bandeja de entrada
- **Test de carga**: Validar performance con múltiples solicitudes simultáneas

---

## Integración con el Backend

### 2. **tsk-be-22-contingencia** — Inhabilitación de servicio

El backend envía `POST` a `N8N_CONTINGENCY_WEBHOOK_URL` después de confirmar la transacción de contingencia. El payload incluye `servicioId`, `servicio`, `motivo` y `usuarios` con la reserva y los horarios afectados. El request lleva `X-SportComplex-Signature: sha256=<hex>`, HMAC-SHA-256 del cuerpo JSON exacto, calculado con `N8N_CONTINGENCY_HMAC_SECRET`.

El workflow receptor debe validar esa firma antes de procesar los datos. La llamada tiene timeout de 2.5 segundos; cualquier fallo se reporta al operador, pero no revierte el bloqueo ni las cancelaciones y no dispara reembolsos. Ver [TSK-BE-22](./workflows.md#contingencia). Para garantizar que no se pierdan eventos si n8n no está disponible, la tarea complementaria **TSK-BE-22b** implementa persistencia y reintentos automáticos (Outbox pattern).

### Endpoint de Registro que Dispara el Workflow

**Archivo**: `apps/web/src/app/api/auth/route.ts`

```typescript
POST /api/auth
Content-Type: application/json

{
  "correo": "usuario@ejemplo.com",
  "nombre": "Juan Pérez",
  "codigoVerificacion": "987654",
  "expiraEnMinutos": 15,
  "usuarioId": "usr-abc123"
}
```

### Llamada desde Backend a Webhook de n8n

```typescript
const response = await fetch(
  `${process.env.N8N_WEBHOOK_URL}/webhook/auth/enviar-codigo`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      correo: email,
      nombre: userName,
      codigoVerificacion: generatedCode,
      expiraEnMinutos: 15,
      usuarioId: userId
    })
  }
);
```

---

## Archivos de Configuración

### JSON del Workflow
- **Ubicación**: `packages/automation/workflows/envio-codigo-verificacion-otp.json`
- **ID del workflow**: `bOl5gks1km1OSqyk`
- **Version ID**: `3ba3754c-d2e2-4bb8-9020-117142f4b53e`
- **Estado**: Activo

---

## Mejoras Futuras

1. **Workflows Adicionales**:
   - Notificación de reservas confirmadas
   - Alerta de cambios en membresía
   - Recordatorios de sesiones programadas
   - Coordinación con personal

2. **Seguridad**:
   - Mover API keys a variables de entorno
   - Implementar rate limiting en webhook
   - Agregar validación de firmas

3. **Monitoreo**:
   - Dashboard de métricas de envíos
   - Alertas automáticas en fallos
   - Tracking de tasa de apertura de emails

4. **Funcionalidad**:
   - Soporte para SMS como alternativa
   - Templates personalizables por tenant
   - Retry automático con backoff exponencial

---

## Contacto y Soporte

Para preguntas sobre workflows:
- Revisar logs en n8n dashboard
- Consultar Resend API documentation
- Validar estructura de payloads con esquemas en `packages/validation`
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
## Integración n8n - Código de Verificación OTP (TSK-AU-01)
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
================================================================================================================================================================
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

- Identificador Jira: TSK-AU-03 (SCRUM-116) / Disparador Backend: TSK-BE-34 (SCRUM-239)
- Historia de Usuario: HU-11 / HU-39 (RF-10)
- Fase del Proyecto: F2 / F3
- Disparador en Backend: `apps/web/src/app/api/payments/route.ts` (alias `POST /api/webhooks/stripe`) vía `dispatchReservationTicketsEmail` (fire-and-forget tras confirmar el pago).
- Criterio de Aceptación / SLA: El comprador recibe el correo con el código QR en
  menos de 60 segundos y puede acceder a su boleto digital en el portal. Webhook responde HTTP 200 en < 2s.


2. ESPECIFICACIÓN DEL WEBHOOK (ENDPOINT)
--------------------------------------------------------------------------------
- Método HTTP: POST
- Path configurado: reservas/despacho-qr
- Authentication: None
- Respond Mode: Using 'Respond to Webhook' Node

- Endpoint Producción:
  https://n8n.akros.lat/webhook/reservas/despacho-qr

- Endpoint Sandbox / Pruebas:
  https://n8n.akros.lat/webhook-test/reservas/despacho-qr

- Encabezados Requeridos (Headers):
  Content-Type: application/json


3. VARIABLES DE ENTORNO EN EL BACKEND (.env)
--------------------------------------------------------------------------------
## Integración n8n - Despacho de Código QR (TSK-AU-03)
N8N_RESERVATION_QR_WEBHOOK_URL="https://n8n.akros.lat/webhook/reservas/despacho-qr"
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
curl -i -X POST https://n8n.akros.lat/webhook-test/reservas/despacho-qr \
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
================================================================================================================================================================
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
  https://n8n.akros.lat/webhook/contingencias/servicio

- Endpoint Sandbox / Pruebas:
  https://n8n.akros.lat/webhook-test/contingencias/servicio

- Encabezados Requeridos (Headers):
  * Content-Type: application/json
  * X-SportComplex-Signature: sha256=<hex_hmac_sha256>

- Configuración del Nodo en n8n:
  * responseMode: "responseNode" (Responde mediante nodos explícitos)
  * rawBody: true (Conserva el cuerpo binario/crudo para cálculo exacto de HMAC)


3. VARIABLES DE ENTORNO EN EL BACKEND (.env)
--------------------------------------------------------------------------------
## Integración n8n - Contingencias Operativas (TSK-AU-05 / TSK-BE-22)
N8N_CONTINGENCY_WEBHOOK_URL="https://n8n.akros.lat/webhook/contingencias/servicio"
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
curl -i -X POST https://n8n.akros.lat/webhook-test/contingencias/servicio \
  -H "Content-Type: application/json" \
  -H "X-SportComplex-Signature: sha256=fdcc234db60b7da9b32f881fc7f66c6958ea9d325443eed7f5b42fae5dd8f7be" \
  -d '{"serviceId":1,"motivo":"Falla imprevista en fluido electrico","servicioNombre":"Cancha Sintetica Principal Futbol 7","afectados":[{"nombreUsuario":"Juan Esteban","emailUsuario":"jebolivar33@gmail.com","codigoReserva":"RES-AKROS-789","fecha":"2026-10-09","horario":"18:00 - 19:00"}]}'

B. Simulación de Rechazo por Firma Inválida (401 Unauthorized):
curl -i -X POST https://n8n.akros.lat/webhook-test/contingencias/servicio \
  -H "Content-Type: application/json" \
  -H "X-SportComplex-Signature: sha256=0000000000000000000000000000000000000000000000000000000000000000" \
  -d '{"serviceId":1,"motivo":"Falla imprevista en fluido electrico","servicioNombre":"Cancha Sintetica Principal Futbol 7","afectados":[{"nombreUsuario":"Juan Esteban","emailUsuario":"jebolivar33@gmail.com","codigoReserva":"RES-AKROS-789","fecha":"2026-10-09","horario":"18:00 - 19:00"}]}'
================================================================================================================================================================
README: TSK-AU-07 — Reporte Automatizado de Analíticas Administrativas (Cron)
Componente: Automation & n8n | Proyecto: SportComplex (AKROS Club)
Rama de Integración: feature/n8n-workflows-au-03-05-07
================================================================================

1. DESCRIPCIÓN GENERAL
--------------------------------------------------------------------------------
Este workflow automatiza la recopilación, consolidación y distribución periódica
de las métricas operativas, ocupación de canchas, eventos de contingencia y
rendimiento financiero hacia la administración de AKROS Club.

A diferencia de los flujos de contingencia y reservas, no depende de un webhook
externo sino que se dispara de manera autónoma mediante un temporizador (Schedule
Trigger). Consulta el endpoint de analíticas del backend, estructura un resumen
ejecutivo con plantilla HTML Dark Mode y envía el reporte a través de la API
de Resend.

- Identificador Jira: TSK-AU-07 (SCRUM-120)
- Tipo de Flujo: Scheduled Job / Analytics Reporter
- Fase del Proyecto: F2
- Criterio de Aceptación / SLA: Entrega programada recurrente del informe en el
  buzón administrativo sin intervención humana.


2. ESPECIFICACIÓN DEL DISPARADOR (SCHEDULE TRIGGER)
--------------------------------------------------------------------------------
- Tipo de Nodo: Schedule Trigger (Cron)
- Frecuencia recomendada: Semanal (Lunes 07:00 AM COT) o Diario
- Zona Horaria: America/Bogota (UTC-5)
- Regla Cron estándar:
  0 7 * * 1 (Cada lunes a las 07:00 AM)


3. VARIABLES DE ENTORNO Y ENDPOINTS (BACKEND / N8N)
--------------------------------------------------------------------------------
## Endpoint real de analíticas expuesto por el backend y consumido por n8n:
BACKEND_ANALYTICS_API_URL="https://akros.lat/api/admin/analytics"

## Destinatarios del reporte consolidado:
ADMIN_REPORT_RECIPIENTS="gerencia@akros.lat,operaciones@akros.lat"


4. CONFIGURACIÓN DEL NODO "Consultar Analytics Backend"
--------------------------------------------------------------------------------
- Tipo de Nodo: HTTP Request (n8n-nodes-base.httpRequest)
- Method: GET
- URL: https://akros.lat/api/admin/analytics
- Authentication: None
- Send Query Parameters: Activado (Specify: Using Fields Below)
- Parámetros de consulta (Query Params) opcionales según el rango a liquidar:
  * periodo / range: "semana_actual" | "mes_actual"
  * limit: 10


5. CONTRATO DE DATOS ESPERADO DESDE EL BACKEND (GET RESPONSE)
--------------------------------------------------------------------------------
Estructura JSON devuelta por el backend al ejecutar la consulta GET:

{
  "periodo": "Semana Operativa 41 (05/10/2026 - 11/10/2026)",
  "metricas": {
    "totalReservas": 142,
    "ingresosTotales": "$11.360.000 COP",
    "tasaOcupacion": "78.4%",
    "contingenciasReportadas": 1,
    "horasPico": "18:00 - 21:00"
  },
  "canchasMasUtilizadas": [
    { "nombre": "Cancha Sintética Principal Fútbol 7", "reservas": 68 },
    { "nombre": "Cancha Múltiple Voleibol / Baloncesto", "reservas": 44 },
    { "nombre": "Cancha Auxiliar Fútbol 5", "reservas": 30 }
  ]
}


6. ARQUITECTURA DE NODOS EN N8N
--------------------------------------------------------------------------------
[Schedule Trigger]
    │  - Disparador programado por tiempo (Cron).
    ▼
[Consultar Analytics Backend] (HTTP Request Node)
    │  - Método: GET
    │  - URL: https://akros.lat/api/admin/analytics
    │  - Authentication: None
    │  - Envío de Query Parameters para filtrar período/métricas.
    ▼
[Construir Reporte HTML] (Code Node)
    │  - Toma el JSON devuelto por el backend.
    │  - Formatea los valores numéricos, porcentajes y listas de ocupación.
    │  - Ensambla la plantilla visual ejecutiva en HTML Dark Mode.
    │  - Construye el objeto resendPayload con asunto, remitente y destinatarios.
    ▼
[Enviar Reporte Resend] (HTTP Request Node)
       - Método: POST a https://api.resend.com/emails
       - Header Auth con la API Key de Resend.
       - Despacha el informe ejecutivo final a los correos administrativos.


7. VERIFICACIÓN Y PRUEBA MANUAL EN N8N
--------------------------------------------------------------------------------
1. Entrar al lienzo del flujo TSK-AU-07 en n8n.
2. Abrir el nodo "Consultar Analytics Backend" y hacer clic en "Execute step".
3. Verificar que el backend responda con el JSON de mét# TSK-BE-22 — Inhabilitación por contingencia y webhook n8n

## Endpoint y transacción

`POST /api/admin/incident` requiere ADMIN y recibe `{ "serviceId": 1, "motivo": "..." }`.

En una transacción se bloquean las disponibilidades del servicio, se crea el registro de inhabilitación, el servicio pasa a `INHABILITADO`, las reservas `PENDIENTE_PAGO` y `CONFIRMADA` pasan a `CANCELADA_ADMINISTRATIVA`, y se liberan sus cupos. Reservas, pagos, usuarios e historial de escaneos se conservan. No se inicia reembolso bancario.

## n8n y firma

Después del commit se envía un POST con el servicio, motivo y reservas/usuarios/horarios afectados. El encabezado `X-SportComplex-Signature` contiene `sha256=<hex>` calculado como HMAC-SHA-256 del cuerpo JSON exacto.

Configurar `N8N_CONTINGENCY_WEBHOOK_URL` y `N8N_CONTINGENCY_HMAC_SECRET` (mínimo 32 caracteres aleatorios) en el entorno del servidor; no guardar secretos reales en el repositorio. El timeout es 2.5 segundos. Respuesta HTTP no exitosa, configuración incompleta o fallo de red se informa como `webhook.sent = false` y se registra, pero no revierte el bloqueo ni las cancelaciones. `webhookEnviadoEn` se actualiza solo tras una respuesta exitosa de n8n. Si n8n respondió exitosamente pero falla la actualización de `webhookEnviadoEn`, la API registra el error y mantiene la respuesta exitosa de la contingencia con `webhookEnviadoRegistrado = false`; no se reintenta automáticamente el webhook.

No se modificó el esquema ni se creó/aplicó una migración. `pnpm --filter web test` incluye las pruebas del webhook y la ruta de contingencia: autorización (401/403), validación (400), respuesta cuando n8n falla y fallo al registrar el despacho. Las pruebas de DB cubren cancelación/liberación de cupos, prevención de doble inhabilitación y conservación de pagos.

## Tarea complementaria: TSK-BE-22b (SCRUM-162)

Para resolver la limitación de entrega cuando n8n se encuentra temporalmente inactivo o inaccesible (evitando que se pierda la notificación a los clientes afectados), se definió **TSK-BE-22b**:
- **Alcance**: Cola persistente de salida (*Outbox pattern*) en base de datos basada en los registros de `inhabilitacion_servicio` con `webhook_enviado_en IS NULL` o cola dedicada.
- **Worker/Job**: Proceso de reintentos periódicos con retroceso exponencial (*exponential backoff*), conservando la firma HMAC `X-SportComplex-Signature` hasta recibir HTTP 2xx de n8n o alcanzar el umbral de *dead-letter* (coordinado con TSK-AU-08 / SCRUM-147).

---

## Restablecimiento de Contraseña (`restablecimiento-contrasena.json`)

- **Disparador**: Webhook HTTP POST en `/webhook/auth-password-reset` (`rawBody: true`).
- **Seguridad**: Verificación HMAC-SHA256 en header `X-SportComplex-Signature` (`sha256=<hex>`) con el secreto compartido `N8N_PASSWORD_RESET_HMAC_SECRET`. Retorna 401 si la firma es inválida.
- **Respuesta síncrona**: HTTP 200 `{ "ok": true, "mensaje": "Solicitud de restablecimiento recibida, despachando correo" }`.
- **Despacho asíncrono**: Resend API (`POST https://api.resend.com/emails`) con `Authorization: Bearer {{ $env.RESEND_API_KEY }}`.
- **Plantilla**: HTML Dark Mode institucional Akros con botón directo a `/reset-password?token=...` y texto de respaldo.

