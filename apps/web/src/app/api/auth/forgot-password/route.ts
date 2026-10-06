import { ok, fail } from '@/lib/api-response'
import { forgotPasswordSchema } from '@sportcomplex/validation'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const validation = forgotPasswordSchema.safeParse(body)
    if (!validation.success) {
      return fail('VALIDATION_ERROR', validation.error.issues[0]?.message ?? 'Datos inválidos.', 400)
    }

    if (!isSupabaseAuthConfigured()) {
      return fail('AUTH_PROVIDER_NOT_CONFIGURED', 'Supabase Auth todavía no está configurado.', 503)
    }

    const supabase = await createSupabaseServerClient()
    const redirectTo = new URL('/auth/callback', request.url)
    const { error } = await supabase.auth.resetPasswordForEmail(validation.data.email, {
      redirectTo: redirectTo.toString(),
    })

    if (error) {
      return fail('PASSWORD_RESET_REQUEST_FAILED', 'No se pudo solicitar el enlace de recuperación.', 502)
    }

    return ok({ message: 'Si ese correo está registrado, recibirás un enlace en breve.' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor.'
    return fail('INTERNAL_SERVER_ERROR', message, 500)
  }
}
