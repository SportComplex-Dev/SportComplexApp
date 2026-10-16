import { z } from 'zod'

// Login (PR: pantalla de login)
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
  password: z
    .string()
    .min(6, 'La contraseña debe contener al menos 6 caracteres'),
})

// RF-01/RF-02 — credenciales y activación
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  nombre: z.string().min(1).max(120),
})

export const resendSchema = z.object({
  email: z.email(),
})

export const verifySchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/),
})

export const createEmployeeSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(120),
  correo: z.string().trim().email('Ingresa un correo electrónico válido'),
  rolNombre: z.enum([
    'ADMIN',
    'ADMINISTRADOR',
    'VENDEDOR',
    'LECTOR',
    'EMPLEADO_VENDEDOR',
    'EMPLEADO_LECTOR',
  ]),
  password: z.string().min(8, 'La contraseña temporal debe contener al menos 8 caracteres').max(72),
})

// TSK-FE-33: Recuperación y restablecimiento de contraseña
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido')
    .email('Ingresa un correo electrónico válido'),
})

export const passwordStrengthRegex = /^(?=.*[a-zA-Z])(?=.*[\d\W]).{8,}$/

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'El token es requerido').optional(),
    password: z
      .string()
      .min(8, 'La contraseña debe contener al menos 8 caracteres')
      .regex(/[a-zA-Z]/, 'La contraseña debe incluir al menos una letra')
      .regex(/[\d\W]/, 'La contraseña debe incluir al menos un número o símbolo'),
    confirmPassword: z
      .string()
      .min(1, 'Por favor confirma la nueva contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ResendInput = z.infer<typeof resendSchema>
export type VerifyInput = z.infer<typeof verifySchema>
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>