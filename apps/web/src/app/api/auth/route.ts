import { ok, fail } from '@sportcomplex/shared/lib'
import { prisma } from '@sportcomplex/db'
import { loginSchema } from '@sportcomplex/validation'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'
import { verifySecret } from '@sportcomplex/security'
import { normalizeRole, signScSessionToken } from '@/lib/session'
import { authGateFor } from '@/lib/auth/auth-gate'
import { resolveAppUserByEmail } from '@/lib/auth/resolve-app-user'
import { findSupabaseUserByEmail } from '@/lib/supabase/admin'

/**
 * Fallback estricto D3: valida contra `usuario.password_hash` (Argon2id) SOLO cuando
 * el correo no tiene identidad en Supabase Auth. Verifica Argon2id (nunca bcrypt) y
 * emite un `sc-token` firmado con AUTH_SECRET para dar sesión sin cuenta Auth.
 */
async function buildLegacySession(email: string, password: string): Promise<Response | null> {
  const user = await prisma.usuario.findFirst({
    where: { correo: { equals: email.trim(), mode: 'insensitive' } },
    include: { rol: true },
  })

  const passwordOk =
    !!user?.passwordHash && !user.deletedAt && (await verifySecret(user.passwordHash, password))
  if (!user || !passwordOk) return null

  const role = normalizeRole(user.rol.nombre)
  if (!role) return null

  const gate = authGateFor(user.estado, Boolean(user.deletedAt))
  if (gate.gate !== 'OK') return fail(gate.code, gate.message, gate.status)

  const token = await signScSessionToken({ sub: user.id, email: user.correo, role, status: user.estado })
  if (!token) {
    // AUTH_SECRET ausente: no devolver 200 sin cookie (reproduciría el "se queda en /login").
    return fail('CONFIG_ERROR', 'Autenticación local no configurada (AUTH_SECRET ausente).', 500)
  }
  const headers: HeadersInit = {
    'Set-Cookie': `sc-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; ${
      process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
    }`,
  }
  return ok(
    {
      user: {
        id: user.id,
        email: user.correo,
        name: user.nombre,
        role,
      },
    },
    headers,
  )
}

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
      // ruta primaria: Supabase Auth valida la identidad (quién eres)
      const supabase = await createSupabaseServerClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error || !data.user) {
        // Fallback estricto: solo si NO existe cuenta de Supabase para este correo.
        if (process.env.AUTH_ALLOW_LOCAL_FALLBACK === 'true') {
          const { data: supabaseMatch, error: lookupError } = await findSupabaseUserByEmail(email)
          if (lookupError) {
            // Fail-closed: un fallo al consultar la Admin API NO debe habilitar el fallback.
            console.error('No se pudo verificar la identidad en Supabase Auth:', lookupError.message)
          } else if (!supabaseMatch?.user) {
            const legacy = await buildLegacySession(email, password)
            if (legacy) return legacy
          }
        }
        return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
      }

      // Autorización (qué puedes): rol y estado salen de la tabla `usuario`, nunca de user_metadata.
      const resolved = await resolveAppUserByEmail(data.user.email ?? email)
      if (!resolved || !resolved.role) {
        return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
      }

      const gate = authGateFor(resolved.status, resolved.deleted)
      if (gate.gate !== 'OK') {
        return fail(gate.code, gate.message, gate.status)
      }

      return ok({
        user: {
          id: resolved.id,
          email: resolved.email,
          name: resolved.name,
          role: resolved.role,
        },
      })
    }

    // Fallback local (solo cuando Supabase Auth NO está configurado): verifica contra
    // password_hash legacy Argon2id (D3=a; ver token.ts y README de packages/db).
    const user = await prisma.usuario.findFirst({
      where: { correo: { equals: email.trim(), mode: 'insensitive' } },
      include: { rol: true },
    })

    const passwordOk =
      !!user?.passwordHash && !user.deletedAt && (await verifySecret(user.passwordHash, password))
    if (!user || !passwordOk) {
      return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
    }

    const role = normalizeRole(user.rol.nombre)
    if (!role) {
      return fail('INVALID_CREDENTIALS', 'Credenciales incorrectas.', 401)
    }

    const gate = authGateFor(user.estado, Boolean(user.deletedAt))
    if (gate.gate !== 'OK') {
      return fail(gate.code, gate.message, gate.status)
    }

    // Responder con los datos del usuario y emitir cookies de sesión perimetral (dev/local)
    const sessionData = {
      userId: user.id,
      email: user.correo,
      name: user.nombre,
      role,
      status: user.estado,
    }

    const response = ok({
      user: {
        id: user.id,
        email: user.correo,
        name: user.nombre,
        role,
      },
    })

    // Cookies de sesión para middleware perimetral (session.ts) y cliente
    response.headers.append('Set-Cookie', `sc-session=${JSON.stringify(sessionData)}; Path=/; SameSite=Lax; Max-Age=86400`)
    response.headers.append('Set-Cookie', `sc-role=${role}; Path=/; SameSite=Lax; Max-Age=86400`)
    response.headers.append('Set-Cookie', `sc-status=${user.estado}; Path=/; SameSite=Lax; Max-Age=86400`)

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error en la conexión a la base de datos'
    return fail('INTERNAL_SERVER_ERROR', message, 500)
  }
}