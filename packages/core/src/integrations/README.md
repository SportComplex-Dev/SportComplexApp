# Integraciones Externas

## `email.ts` — Despacho de Código de Verificación (seam TSK-AU-01)

### Propósito
Enviar el código de 6 dígitos **en claro** al servicio de correo mediante el webhook de n8n. Como el hash Argon2id es irreversible, el código solo existe en memoria del proceso durante la petición: debe despacharse antes de finalizar `register`/`resend`.

### Exportaciones
| Exportación | Descripción |
|-------------|-------------|
| `VerificationCodeEmailParams` | `{ usuarioId?, to, nombre, code, expiraEn }` — parámetros de entrada del seam. |
| `VerificationCodeWebhookPayload` | Tipo TypeScript del payload HTTP POST enviado al webhook. |
| `sendVerificationCodeEmail(params)` | POST no bloqueante a `N8N_AUTH_EMAIL_WEBHOOK_URL` (timeout 2.5 s, sin reintentos). |

### Contrato del Payload hacia n8n (camelCase)
El payload despachado sigue el estándar en camelCase:

```json
{
  "usuarioId": "c4f9a721-3e5b-4819-a1b7-9d6e52c803f4",
  "correo": "user@mail.com",
  "nombre": "Prueba Akros",
  "codigoVerificacion": "112233",
  "expiraEnMinutos": 15
}
```

#### Descripción de Campos:
- `usuarioId` *(opcional, string UUID)*: Identificador del usuario en la base de datos.
- `correo` *(requerido, string email)*: Correo destinatario.
- `nombre` *(requerido, string)*: Nombre para personalización de la plantilla HTML.
- `codigoVerificacion` *(requerido, string 6 dígitos)*: Código numérico en memoria.
- `expiraEnMinutos` *(requerido, integer)*: Minutos de vigencia del token (calculado dinámicamente: `Math.round((expiraEn - now) / 60000)`).

### Comportamiento y Resiliencia
- **Fire-and-forget (RN-12, ARCHITECTURE §9.4):** Los fallos de red, timeouts o códigos de error HTTP de n8n no revierten la base de datos; el usuario queda creado y puede solicitar un reenvío. Solo se registra un `console.warn`.
- Si `N8N_AUTH_EMAIL_WEBHOOK_URL` no está configurada, la función termina de inmediato sin llamadas HTTP.
- **Timeout:** 2500 ms con 0 reintentos para no bloquear las solicitudes del cliente.

### Esquema Zod en `@sportcomplex/validation`
El esquema formal se encuentra exportado en `@sportcomplex/validation`:
- `n8nAuthEmailWebhookPayloadSchema`
- `n8nAuthEmailWebhookResponseSchema`

### Uso en el Backend
```typescript
import { sendVerificationCodeEmail } from "@sportcomplex/core";

// Después de persistir el hash del token:
await sendVerificationCodeEmail({
  usuarioId: usuario.id,
  to: email,
  nombre: usuario.nombre,
  code,
  expiraEn,
});
```
