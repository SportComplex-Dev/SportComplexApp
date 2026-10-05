# Documentación de Automatización - Complejo Deportivo

## Descripción General

Este documento describe el sistema de automatización del Complejo Deportivo implementado con **n8n**. Los workflows automáticos manejan procesos críticos de comunicación, validación y notificaciones.

## Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Workflows Disponibles](#workflows-disponibles)
3. [Integración con Backend](#integración-con-backend)
4. [Schemas de Validación](#schemas-de-validación)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## Arquitectura

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Next.js)                        │
│                  /api/auth, /api/bookings, etc.             │
└────────┬────────────────────────────────────────────────────┘
         │
         │ HTTP Request con Payload JSON
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                  n8n Webhook (Trigger)                       │
│           /webhook/auth/enviar-codigo                        │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              n8n Workflow Automation Pipeline                │
│  [Trigger] → [Processor] → [Integration] → [Response]       │
└────────┬────────────────────────────────────────────────────┘
         │
         ├─── HTTP Request ──→ Resend API
         ├─── Database ──────→ Prisma ORM
         └─── Services ──────→ External APIs
```

### Stack Tecnológico

- **n8n**: Plataforma de automatización self-hosted
- **Resend**: Servicio de envío de emails
- **Prisma**: ORM para interacción con base de datos
- **TypeScript/Zod**: Validación de datos

---

## Workflows Disponibles

### 1. **tsk-au-01-envio-codigo**

**Nombrado**: `Envío de Código de Verificación`

**Propósito**: Automatizar el envío de códigos de verificación por email durante:
- Registro de nuevos usuarios
- Verificación de dos factores
- Confirmación de cambios de email
- Procesos de recuperación de contraseña

**Tipo de Disparador**: Webhook HTTP POST

**Endpoint**: `POST /webhook/auth/enviar-codigo`

**Estado**: ✅ Activo

Véase [N8N_WORKFLOWS.md](./N8N_WORKFLOWS.md) para detalles completos.

---

## Integración con Backend

### Llamada desde Next.js al Webhook de n8n

**Ubicación típica del código**: `apps/web/src/app/api/auth/route.ts`

```typescript
import { SendVerificationCodeSchema } from "@sportcomplex/validation";

export async function POST(request: Request) {
  const { email, userName, userId } = await request.json();

  // Generar código de verificación
  const verificationCode = generateCode(); // 123456

  // Preparar payload para n8n
  const payload = {
    correo: email,
    nombre: userName,
    codigoVerificacion: verificationCode,
    expiraEnMinutos: 15,
    usuarioId: userId,
  };

  // Validar antes de enviar
  const validatedPayload = SendVerificationCodeSchema.parse(payload);

  // Enviar al webhook de n8n
  try {
    const response = await fetch(
      `${process.env.N8N_WEBHOOK_BASE_URL}/webhook/auth/enviar-codigo`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Opcional: agregar autenticación extra
          // "Authorization": `Bearer ${process.env.N8N_WEBHOOK_TOKEN}`
        },
        body: JSON.stringify(validatedPayload),
      }
    );

    const result = await response.json();

    // Responder al cliente
    return Response.json({
      ok: true,
      message: "Código enviado exitosamente",
    });
  } catch (error) {
    console.error("Error enviando código de verificación:", error);
    return Response.json(
      {
        ok: false,
        message: "Error al enviar código",
      },
      { status: 500 }
    );
  }
}
```

### Variables de Entorno Necesarias

En **apps/web/.env.local** o **.env.production**:

```env
# n8n Configuration
N8N_WEBHOOK_BASE_URL=https://n8n.tudominio.com
N8N_WEBHOOK_TOKEN=tu-token-opcional (si está configurado)

# Resend API
RESEND_API_KEY=re_YOUR_API_KEY_HERE
```

### Manejo de Errores

```typescript
// Validación de datos antes de enviar
try {
  const validPayload = SendVerificationCodeSchema.parse(rawData);
} catch (error) {
  // Zod lanza errores estructurados
  return Response.json(
    {
      ok: false,
      errors: error.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    },
    { status: 400 }
  );
}

// Manejo en n8n
// Si la solicitud falla, n8n reintentará automáticamente 2 veces
```

---

## Schemas de Validación

### Ubicación: `packages/validation/src/automation.schema.ts`

#### SendVerificationCodeSchema

**Entradas esperadas:**

```typescript
interface SendVerificationCodePayload {
  correo: string;           // Email válido, requerido
  nombre?: string;          // Máximo 100 caracteres (default: "Usuario")
  codigoVerificacion: string; // 4-8 dígitos
  expiraEnMinutos?: number; // 1-1440 minutos (default: 15)
  usuarioId: string;        // Alfanumérico, requerido
}
```

**Ejemplo de uso:**

```typescript
import { 
  validateSendVerificationCode, 
  trySendVerificationCode,
  createTestVerificationCodePayload 
} from "@sportcomplex/validation/automation.schema";

// Validar (lanza error si falla)
const payload = validateSendVerificationCode({
  correo: "usuario@ejemplo.com",
  nombre: "Juan Pérez",
  codigoVerificacion: "945782",
  usuarioId: "usr-abc123",
});

// Validar sin lanzar error
const safePayload = trySendVerificationCode(untrustedData);
if (!safePayload) {
  console.error("Datos inválidos");
}

// Crear payload de prueba
const test = createTestVerificationCodePayload({
  correo: "test@custom.com"
});
```

---

## Tipos de Workflows (Futuros)

### Notificaciones de Reservas
```
Webhook: /webhook/bookings/confirmar
Disparador: Cuando se confirma una reserva
Output: Email + SMS al cliente
```

### Alertas de Personal
```
Webhook: /webhook/staff/alert
Disparador: Cambio de disponibilidad
Output: Notificación a staff involucrado
```

### Sincronización de Datos
```
Webhook: /webhook/sync/{entity}
Disparador: Cambios en base de datos
Output: Actualizar cache, notificar clientes
```

---

## Deployment

### En Producción

1. **Configurar n8n**
   ```bash
   # .env de n8n
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=admin
   N8N_BASIC_AUTH_PASSWORD=contraseña-segura
   ```

2. **Exportar Workflow**
   - En n8n UI: Menu → Download → JSON
   - Guardar en `packages/automation/workflows/`

3. **Importar Workflow**
   - En n8n UI: Menu → Import → Seleccionar JSON
   - Configurar API keys de Resend
   - Activar workflow

4. **Configurar URL**
   ```
   Backend: N8N_WEBHOOK_BASE_URL=https://n8n.prod.tudominio.com
   Webhook: https://n8n.prod.tudominio.com/webhook/auth/enviar-codigo
   ```

### Testing Local

```typescript
// tests/automation.test.ts
import { validateSendVerificationCode } from "@sportcomplex/validation";

describe("Automation Schemas", () => {
  it("debe validar payload correcto", () => {
    const payload = {
      correo: "test@ejemplo.com",
      codigoVerificacion: "123456",
      usuarioId: "usr-123",
    };
    expect(() => validateSendVerificationCode(payload)).not.toThrow();
  });

  it("debe rechazar correo inválido", () => {
    const payload = {
      correo: "invalid-email",
      codigoVerificacion: "123456",
      usuarioId: "usr-123",
    };
    expect(() => validateSendVerificationCode(payload)).toThrow();
  });
});
```

---

## Troubleshooting

### El email no se envía

**Verificar:**
1. ¿El webhook está activo en n8n?
2. ¿La API key de Resend es válida?
3. ¿El correo destino está en la whitelist de Resend?
4. Ver logs en n8n Dashboard → Executions

### Payload rechazado

**Verificar con validador:**
```typescript
import { trySendVerificationCode } from "@sportcomplex/validation";

const result = trySendVerificationCode(data);
if (!result) console.error("Payload inválido");
```

### Reintentos agotados

**Configurar en n8n:**
- HTTP Request → Configure → Retry (Tab)
- Aumentar intentos de reintento
- Ajustar tiempo entre reintentos

### Rate Limiting

**Si n8n recibe muchas solicitudes:**
1. Agregar delays en backend
2. Implementar cola de mensajes (Bull, RabbitMQ)
3. Configurar backoff exponencial en reintentos

---

## Monitoreo

### Métricas Importantes

- **Tasa de entrega**: % de emails enviados exitosamente
- **Latencia**: Tiempo hasta que el cliente recibe respuesta
- **Errores**: % de ejecuciones fallidas
- **Reintentos**: Cuántas veces se reintentan fallos

### Dashboard Recomendado

```
n8n → Executions (Tab)
├─ Success Rate
├─ Average Duration
├─ Recent Errors
└─ Retry Count
```

---

## Referencias

- [Documentación completa de workflows](./N8N_WORKFLOWS.md)
- [Schemas de validación](../packages/validation/src/automation.schema.ts)
- [n8n Official Docs](https://docs.n8n.io/)
- [Resend Email API](https://resend.com/docs)

