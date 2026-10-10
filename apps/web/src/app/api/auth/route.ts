import { ok, fail } from '@/lib/api-response'
import { prisma } from '@sportcomplex/db'
import { loginSchema } from '@sportcomplex/validation'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'
import { verifySecret } from '@sportcomplex/core'
import { normalizeRole } from '@/lib/session'

const supportedRoles = [
  'Administrador',
  'Empleado_Vendedor',
  'Empleado_Lector',
  'Cliente',
] as const

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // 1. Validar el formato con el contrato Zod oficial
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return fail('VALIDATION_ERROR', validation.error.issues[0]?.message ?? 'Datos inválidos', 400)
    }

    const { email, password } = validation.data

    if (isSupabaseAuthConfigured()) {
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error || !data.user) {
        return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
      }

      const metadata = data.user.user_metadata
      const metadataRole = metadata.role
      const role = typeof metadataRole === 'string'
        ? supportedRoles.find((supportedRole) => supportedRole === metadataRole) ?? 'Cliente'
        : 'Cliente'
      const metadataName = metadata.name ?? metadata.full_name
      const name = typeof metadataName === 'string' && metadataName.trim()
        ? metadataName.trim()
        : data.user.email?.split('@')[0] ?? 'Usuario'

      return ok({
        user: {
          id: data.user.id,
          email: data.user.email ?? email,
          name,
          role,
        },
      })
    }

    // 2. Buscar al usuario en la base de datos
    const user = await prisma.usuario.findUnique({
      where: { correo: email.toLowerCase().trim() },
      include: { rol: true },
    })

    // 3. Comparar contraseña contra el hash Argon2id (nunca en texto plano)
    const passwordOk =
      !!user?.passwordHash && !user.deletedAt && (await verifySecret(user.passwordHash, password))
    if (!user || !passwordOk) {
      return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
    }

    if (user.estado === 'PENDIENTE') {
      return fail('ACCOUNT_PENDING', 'Verifica tu correo antes de ingresar.', 403)
    }
    if (user.estado !== 'ACTIVO') {
      return fail('ACCOUNT_INACTIVE', 'Tu cuenta está inactiva.', 403)
    }

    // 4. Responder con los datos del usuario y emitir cookies de sesión perimetral
    const canonicalRole = normalizeRole(user.rol.nombre) ?? 'Cliente'
    const sessionData = {
      userId: user.id,
      email: user.correo,
      name: user.nombre,
      role: canonicalRole,
      status: user.estado,
    }

    const response = ok({
      user: {
        id: user.id,
        email: user.correo,
        name: user.nombre,
        role: canonicalRole,
      },
    })

    // Cookies de sesión para middleware perimetral (session.ts) y cliente
    response.headers.append('Set-Cookie', `sc-session=${JSON.stringify(sessionData)}; Path=/; SameSite=Lax; Max-Age=86400`)
    response.headers.append('Set-Cookie', `sc-role=${canonicalRole}; Path=/; SameSite=Lax; Max-Age=86400`)
    response.headers.append('Set-Cookie', `sc-status=${user.estado}; Path=/; SameSite=Lax; Max-Age=86400`)

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la conexión a la base de datos'
    return fail('INTERNAL_SERVER_ERROR', message, 500)
  }
}