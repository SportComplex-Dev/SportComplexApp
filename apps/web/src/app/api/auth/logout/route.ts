import { ok } from '@/lib/api-response'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'

const COOKIES_TO_EXPIRE = [
  'sc-session',
  'sc-role',
  'sc-status',
  'sc-token',
  'authjs.session-token',
  '__Secure-authjs.session-token',
]

/**
 * Cabecera Set-Cookie para expirar una cookie de sesión. `secure` debe
 * reflejar cómo se creó la cookie: un Set-Cookie sin `Secure` NO puede
 * borrar una cookie `__Secure-*` (regla de prefijos del navegador), y en
 * producción `sc-token` se emite con `Secure`.
 */
export function expiredCookieHeader(cookieName: string, secure: boolean): string {
  return (
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; ` +
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`
  )
}

function buildLogoutResponse() {
  const secure = process.env.NODE_ENV === 'production'
  const response = ok({ message: 'Sesión cerrada exitosamente.' })
  for (const cookieName of COOKIES_TO_EXPIRE) {
    response.headers.append('Set-Cookie', expiredCookieHeader(cookieName, secure))
  }
  return response
}

async function signOutSupabase() {
  if (!isSupabaseAuthConfigured()) return
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } catch {
    // Un fallo de Supabase no debe impedir expirar las cookies de sesión propias.
  }
}

export async function POST() {
  await signOutSupabase()
  return buildLogoutResponse()
}

// Sin handler GET a propósito: el logout es un cambio de estado y por GET
// sería disparable por CSRF (navegación, <img>, prefetch). Solo POST.
