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

function buildLogoutResponse() {
  const response = ok({ message: 'Sesión cerrada exitosamente.' })
  for (const cookieName of COOKIES_TO_EXPIRE) {
    response.headers.append(
      'Set-Cookie',
      `${cookieName}=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    )
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

export async function GET() {
  await signOutSupabase()
  return buildLogoutResponse()
}
