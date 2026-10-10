import { ok } from '@/lib/api-response'

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

export async function POST() {
  return buildLogoutResponse()
}

export async function GET() {
  return buildLogoutResponse()
}
