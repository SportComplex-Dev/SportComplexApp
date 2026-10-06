import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'La contraseña debe contener al menos 6 caracteres.'),
})

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json()
    const validation = resetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return fail('VALIDATION_ERROR', validation.error.issues[0]?.message ?? 'Datos inválidos.', 400)
    }

    if (!isSupabaseAuthConfigured()) {
      return fail('AUTH_PROVIDER_NOT_CONFIGURED', 'Supabase Auth todavía no está configurado.', 503)
    }

    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.updateUser({ password: validation.data.password })
    if (error) {
      return fail('PASSWORD_UPDATE_FAILED', 'El enlace no es válido o ya expiró. Solicita uno nuevo.', 400)
    }

    return ok({ message: 'La contraseña se actualizó correctamente.' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return fail('INTERNAL_SERVER_ERROR', message, 500)
  }
}
