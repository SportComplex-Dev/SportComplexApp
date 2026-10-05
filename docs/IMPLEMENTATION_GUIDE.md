# Guía Rápida de Implementación - n8n en el Backend

## 1. Configuración Inicial

### Variables de Entorno

**Archivo: `apps/web/.env.local` (desarrollo) o `.env.production` (producción)**

```env
# n8n Configuration
N8N_WEBHOOK_BASE_URL=https://n8n.tudominio.com
N8N_WEBHOOK_TOKEN=tu-token-opcional

# Resend Email API
RESEND_API_KEY=re_...
```

### Instalación de Dependencias

Las dependencias ya están en `package.json`, solo asegúrate de instalar:

```bash
pnpm install
# Se instalarán automáticamente:
# - ky (cliente HTTP para webhooks)
# - zod (validación de schemas)
```

---

## 2. Pasos para Usar en tu Endpoint

### Paso 1: Importar las Funciones

```typescript
import { sendVerificationCodeWebhook } from "@repo/core";
import { SendVerificationCodeSchema } from "@repo/validation";
```

### Paso 2: Generar Código de Verificación

```typescript
const code = Math.floor(100000 + Math.random() * 900000).toString();
// Resultado: "123456"
```

### Paso 3: Construir el Payload

```typescript
const payload = {
  correo: email,
  nombre: userName,
  codigoVerificacion: code,
  expiraEnMinutos: 15,
  usuarioId: userId,
};
```

### Paso 4: Validar (Opcional pero Recomendado)

```typescript
try {
  const validated = SendVerificationCodeSchema.parse(payload);
  // Payload es válido
} catch (error) {
  // Datos inválidos, no enviar a n8n
  console.error("Payload inválido:", error);
}
```

### Paso 5: Enviar al Webhook

```typescript
try {
  const response = await sendVerificationCodeWebhook(payload);
  console.log("Respuesta:", response.ok, response.mensaje);
} catch (error) {
  console.error("Error enviando código:", error.message);
  // Manejar error (retry, fallback, etc)
}
```

---

## 3. Ejemplo Completo: Endpoint de Registro

```typescript
// File: apps/web/src/app/api/auth/register/route.ts

import { NextRequest, NextResponse } from "next/server";
import { sendVerificationCodeWebhook } from "@repo/core";

export async function POST(request: NextRequest) {
  try {
    const { email, name, password } = await request.json();

    // Validaciones básicas
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Campos requeridos" },
        { status: 400 }
      );
    }

    // Generar código
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const userId = `user_${Date.now()}`; // Ejemplo simple

    // Guardar en BD (pseudocódigo)
    // const user = await db.user.create({
    //   email,
    //   name,
    //   password: await hash(password),
    //   verificationCode,
    //   verificationCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
    //   isVerified: false,
    // });

    // Enviar código por email
    const emailResponse = await sendVerificationCodeWebhook({
      correo: email,
      nombre: name,
      codigoVerificacion: verificationCode,
      expiraEnMinutos: 15,
      usuarioId: userId,
    });

    return NextResponse.json({
      ok: true,
      message: "Usuario registrado. Verifica tu correo.",
      userId,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

---

## 4. Casos de Uso

### A) Registro de Nuevo Usuario
1. Usuario completa formulario de registro
2. Backend genera código de 6 dígitos
3. Dispara webhook de n8n
4. Cliente recibe email con código
5. Usuario verifica código en pantalla de verificación

### B) Recuperación de Contraseña
1. Usuario solicita resetear contraseña
2. Backend busca usuario por email
3. Genera código temporal
4. Envía vía n8n webhook
5. Usuario ingresa código y nueva contraseña

### C) Cambio de Email
1. Usuario solicita cambiar email
2. Genera código para nuevo email
3. Envía verificación a nuevo email
4. Usuario verifica
5. Email se actualiza en BD

### D) Autenticación de Dos Factores (2FA)
1. Usuario intenta login
2. Backend verifica contraseña
3. Genera código 2FA
4. Envía a número registrado (o email)
5. Usuario ingresa código para completar login

---

## 5. Flujo Completo en Diagrama

```
┌─────────────────────┐
│   Usuario (UI)      │
│  Completa Registro  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────┐
│  POST /api/auth/register    │
│  Body: { email, name, pwd } │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ Backend: nodejs/next.js       │
│ 1. Validar datos             │
│ 2. Hash contraseña           │
│ 3. Generar código (123456)   │
│ 4. Guardar en BD             │
└──────────┬───────────────────┘
           │
           │ Payload JSON
           │ (correo, código, etc)
           │
           ▼
┌──────────────────────────────┐
│ n8n Webhook                   │
│ /webhook/auth/enviar-codigo  │
│ 1. Recibe solicitud          │
│ 2. Construye email HTML      │
│ 3. Prepara datos para Resend │
└──────────┬───────────────────┘
           │
           │ HTTP Request
           │ (email HTML, destinatario)
           │
           ▼
┌──────────────────────────────┐
│ Resend Email Service         │
│ POST https://api.resend.com  │
│ 1. Valida email              │
│ 2. Envía                     │
│ 3. Devuelve ID de rastreo    │
└──────────┬───────────────────┘
           │
           │ Email enviado
           │
           ▼
┌──────────────────────────────┐
│ Bandeja de Usuario           │
│ Email con código 123456      │
└──────────┬───────────────────┘
           │
           │ Usuario copia código
           │
           ▼
┌──────────────────────────────┐
│ UI: Pantalla de Verificación │
│ Input: Ingresa código        │
└──────────┬───────────────────┘
           │
           │ POST /api/auth/verify-code
           │ Body: { code: "123456" }
           │
           ▼
┌──────────────────────────────┐
│ Backend: Verifica código     │
│ 1. Busca usuario             │
│ 2. Valida código + expiración│
│ 3. Marca como verificado     │
│ 4. Retorna JWT o sesión      │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│ ✓ Registro Completado       │
│   Usuario puede hacer login  │
└──────────────────────────────┘
```

---

## 6. Manejo de Errores

### Errores Comunes

```typescript
// Error: N8N_WEBHOOK_BASE_URL no configurado
// Solución: Agregar variable de entorno

// Error: Invalid email format
// Solución: Validar email antes de enviar
SendVerificationCodeSchema.parse(payload); // Lanza error si es inválido

// Error: Código no sigue el patrón
// Solución: El código debe ser 4-8 dígitos
const code = "1234"; // ✓ Válido
const code = "12"; // ✗ Inválido (< 4 dígitos)
```

### Estrategia de Reintentos

```typescript
// n8n ya reintenta automáticamente 2 veces
// Si necesitas reintentos adicionales en backend:

async function sendWithRetry(payload: SendVerificationCodePayload, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await sendVerificationCodeWebhook(payload);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(`Intento ${attempt} falló, reintentando...`);
      await new Promise(r => setTimeout(r, 2000 * attempt)); // Backoff
    }
  }
}
```

---

## 7. Seguridad

### ✓ Hacer

- ✓ Validar payloads con `SendVerificationCodeSchema.parse()`
- ✓ Usar HTTPS siempre
- ✓ Guardar `N8N_WEBHOOK_TOKEN` en variables de entorno
- ✓ No incluir el código en respuestas del servidor
- ✓ Expirar códigos después de 15 minutos
- ✓ Limitar intentos fallidos (rate limiting)

### ✗ Evitar

- ✗ Hardcodear API keys en código
- ✗ Devolver código de verificación en responses
- ✗ Código sin expiración
- ✗ Permitir reintentos infinitos del código
- ✗ Logs con datos sensibles (email, código)

---

## 8. Testing

### Test Unitario

```typescript
import { validateSendVerificationCode } from "@repo/validation";

describe("Verificación de Email", () => {
  it("debería validar payload correcto", () => {
    const payload = {
      correo: "test@ejemplo.com",
      nombre: "Juan",
      codigoVerificacion: "123456",
      usuarioId: "usr-123",
    };
    expect(() => validateSendVerificationCode(payload)).not.toThrow();
  });

  it("debería rechazar email inválido", () => {
    const payload = {
      correo: "invalid-email",
      codigoVerificacion: "123456",
      usuarioId: "usr-123",
    };
    expect(() => validateSendVerificationCode(payload)).toThrow();
  });
});
```

### Test de Integración (con Mock)

```typescript
// Mock del webhook
jest.mock("@repo/core", () => ({
  sendVerificationCodeWebhook: jest.fn().mockResolvedValue({
    ok: true,
    mensaje: "Código enviado",
  }),
}));

it("debería registrar usuario y enviar código", async () => {
  const response = await POST(mockRequest);
  expect(response.status).toBe(200);
  expect(sendVerificationCodeWebhook).toHaveBeenCalled();
});
```

---

## 9. Troubleshooting

| Problema | Causa | Solución |
|----------|-------|----------|
| `N8N_WEBHOOK_BASE_URL no está configurado` | Variable de entorno falta | Agregar en .env.local |
| `Invalid email format` | Email no es válido | Validar con `SendVerificationCodeSchema` |
| `Send timeout` | n8n muy lento o no disponible | Aumentar timeout o revisar n8n |
| `Invalid API key` | Resend API key inválida en n8n | Revisar configuración en n8n dashboard |
| `Code already sent` | Demasiadas solicitudes en poco tiempo | Implementar rate limiting |

---

## 10. Recursos Útiles

- 📄 [N8N_WORKFLOWS.md](../N8N_WORKFLOWS.md) - Documentación completa del workflow
- 📄 [AUTOMATION.md](../AUTOMATION.md) - Arquitectura completa
- 📝 [automation.schema.ts](../packages/validation/src/automation.schema.ts) - Schemas Zod
- 🔧 [n8n.ts](../packages/core/src/integrations/n8n.ts) - Implementación
- 💻 [IMPLEMENTATION_EXAMPLES.ts](./IMPLEMENTATION_EXAMPLES.ts) - Ejemplos de código

---

## Contacto

Para preguntas o issues:
1. Revisar logs en n8n dashboard
2. Consultar documentación de Resend API
3. Revisar errores de validación de Zod

