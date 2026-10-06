import { z } from 'zod'

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

export const registerSchema = loginSchema.extend({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe contener al menos 2 caracteres'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>