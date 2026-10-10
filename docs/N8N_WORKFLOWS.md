# Documentación de Workflows n8n - Complejo Deportivo

## Descripción General

Este documento describe los workflows automáticos implementados en n8n para el Complejo Deportivo. Los workflows manejan procesos automatizados de comunicación, validación y notificaciones.

---

## Workflows Disponibles

### 1. **tsk-au-01-envio-codigo** - Envío de Código de Verificación

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

El workflow receptor debe validar esa firma antes de procesar los datos. La llamada tiene timeout de 2.5 segundos; cualquier fallo se reporta al operador, pero no revierte el bloqueo ni las cancelaciones y no dispara reembolsos. Ver [TSK-BE-22](./TSK-BE-22-contingencia-webhook-hmac.md). Para garantizar que no se pierdan eventos si n8n no está disponible, la tarea complementaria **TSK-BE-22b** implementa persistencia y reintentos automáticos (Outbox pattern).

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
- **Ubicación**: `packages/automation/workflows/tsk-au-01-envio-codigo.json`
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
