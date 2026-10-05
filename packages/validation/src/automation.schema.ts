import { z } from "zod";

/**
 * Esquemas de validación para workflows de n8n
 * Utilizados para validar payloads antes de enviar a webhooks de n8n
 */

// ============================================================================
// WORKFLOW: tsk-au-01-envio-codigo (Envío de Código de Verificación)
// ============================================================================

/**
 * Schema para el payload de entrada del webhook de envío de código
 * 
 * Validaciones:
 * - correo: Email válido y requerido
 * - nombre: String opcional, máximo 100 caracteres
 * - codigoVerificacion: String de 4-8 caracteres (mayormente 6 dígitos)
 * - expiraEnMinutos: Número positivo entre 1 y 1440 a minutos (1 día)
 * - usuarioId: String requerido, alfanumérico
 */
export const SendVerificationCodeSchema = z.object({
  correo: z
    .string()
    .email("El correo debe ser un email válido")
    .toLowerCase()
    .trim(),
  nombre: z
    .string()
    .max(100, "El nombre no puede exceder 100 caracteres")
    .default("Usuario")
    .optional(),
  codigoVerificacion: z
    .string()
    .regex(/^[0-9]{4,8}$/, "El código debe ser de 4-8 dígitos")
    .describe("Código de verificación (generalmente 6 dígitos)"),
  expiraEnMinutos: z
    .number()
    .int()
    .min(1, "El código debe expirar en al menos 1 minuto")
    .max(1440, "El código no puede expirar en más de 1440 minutos (24 horas)")
    .default(15)
    .optional(),
  usuarioId: z
    .string()
    .min(1, "El usuarioId es requerido")
    .regex(/^[a-zA-Z0-9._-]+$/, "El usuarioId debe ser alfanumérico"),
});

export type SendVerificationCodePayload = z.infer<
  typeof SendVerificationCodeSchema
>;

/**
 * Schema para la respuesta del webhook
 * Indica si el código fue enviado exitosamente
 */
export const SendVerificationCodeResponseSchema = z.object({
  ok: z.boolean().describe("Indica si el proceso fue exitoso"),
  mensaje: z.string().describe("Mensaje de confirmación o error"),
  id: z.string().optional().describe("ID de rastreo del email (si existe)"),
});

export type SendVerificationCodeResponse = z.infer<
  typeof SendVerificationCodeResponseSchema
>;

/**
 * Schema para el HTML generado internamente por el workflow
 * (No se valida desde fuera, pero se documenta la estructura)
 */
export const VerificationEmailTemplateSchema = z.object({
  destinatario: z.string().email(),
  asunto: z.string(),
  html: z.string().describe("Template HTML del email"),
  usuarioId: z.string(),
});

export type VerificationEmailTemplate = z.infer<
  typeof VerificationEmailTemplateSchema
>;

/**
 * Schema para la respuesta de Resend API
 * (API externa que n8n consume)
 */
export const ResendEmailResponseSchema = z.object({
  id: z.string().describe("Email ID de Resend"),
  from: z.string(),
  to: z.array(z.string()),
  created_at: z.string(),
});

export type ResendEmailResponse = z.infer<typeof ResendEmailResponseSchema>;

// ============================================================================
// SCHEMAS GENÉRICOS PARA WORKFLOWS
// ============================================================================

/**
 * Schema base para cualquier webhook de workflow
 * Puede extenderse para workflows específicos
 */
export const WebhookPayloadBaseSchema = z.object({
  timestamp: z.date().optional().default(() => new Date()),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Schema para respuesta estándar de webhooks
 */
export const WebhookResponseSchema = z.object({
  ok: z.boolean(),
  mensaje: z.string(),
  data: z.record(z.string(), z.any()).optional(),
  errores: z.array(z.string()).optional(),
});

export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;

// ============================================================================
// VALIDADORES UTILITARIOS
// ============================================================================

/**
 * Validar y procesar payload de envío de código de verificación
 *
 * @param data - Datos a validar
 * @returns Payload validado y procesado
 * @throws Error de validación de Zod si los datos no son válidos
 *
 * @example
 * ```typescript
 * const payload = validateSendVerificationCode({
 *   correo: 'usuario@ejemplo.com',
 *   nombre: 'Juan',
 *   codigoVerificacion: '123456',
 *   usuarioId: 'usr-123'
 * });
 * ```
 */
export function validateSendVerificationCode(
  data: unknown
): SendVerificationCodePayload {
  return SendVerificationCodeSchema.parse(data);
}

/**
 * Validar respuesta del webhook de envío de código
 *
 * @param data - Datos de respuesta
 * @returns Respuesta validada
 * @throws Error de validación de Zod si los datos no son válidos
 */
export function validateSendVerificationCodeResponse(
  data: unknown
): SendVerificationCodeResponse {
  return SendVerificationCodeResponseSchema.parse(data);
}

/**
 * Validar de forma segura y retornar resultado o null
 * Útil cuando quieres manejar errores sin lanzar excepciones
 *
 * @param data - Datos a validar
 * @returns Payload validado o null
 */
export function trySendVerificationCode(
  data: unknown
): SendVerificationCodePayload | null {
  try {
    return validateSendVerificationCode(data);
  } catch {
    return null;
  }
}

// ============================================================================
// FACTORIES - Crear payloads de prueba
// ============================================================================

/**
 * Crear un payload de prueba para el workflow de envío de código
 * Útil para testing y validación
 */
export function createTestVerificationCodePayload(
  overrides?: Partial<SendVerificationCodePayload>
): SendVerificationCodePayload {
  return SendVerificationCodeSchema.parse({
    correo: "test@ejemplo.com",
    nombre: "Usuario Prueba",
    codigoVerificacion: "123456",
    expiraEnMinutos: 15,
    usuarioId: "test-user-123",
    ...overrides,
  });
}

