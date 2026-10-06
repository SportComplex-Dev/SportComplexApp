import { z } from 'zod'

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'El correo electrónico es requerido.')
    .email('Ingresa un correo electrónico válido.'),
})

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
