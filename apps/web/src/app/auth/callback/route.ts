import { NextResponse } from 'next/server'
import { roleHome, type Role } from '@sportcomplex/core'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'

const supportedRoles: Role[] = ['Administrador', 'Empleado_Vendedor', 'Empleado_Lector', 'Cliente']

function getUserRole(role: unknown): Role {
  return supportedRoles.find((supportedRole) => supportedRole === role) ?? 'Cliente'
}

function getSafeNextPath(path: string | null, origin: string) {
  if (!path || !path.startsWith('/')) return null
  return new URL(path, origin).origin === origin ? path : null
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const isOAuth = requestUrl.searchParams.get('flow') === 'oauth'

  if (isOAuth && requestUrl.searchParams.has('error')) {
    return NextResponse.redirect(new URL('/login?error=google', requestUrl.origin))
  }

  if (!code) {
    if (isOAuth) {
      return NextResponse.redirect(new URL('/login?error=google', requestUrl.origin))
    }
    const errorUrl = new URL('/reset-password?error=invalid_link', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  if (!isSupabaseAuthConfigured()) {
    if (isOAuth) {
      return NextResponse.redirect(new URL('/login?error=configuration', requestUrl.origin))
    }
    const errorUrl = new URL('/reset-password?error=configuration', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    if (isOAuth) {
      return NextResponse.redirect(new URL('/login?error=google', requestUrl.origin))
    }
    const errorUrl = new URL('/reset-password?error=invalid_link', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  if (isOAuth && data.user) {
    const role = getUserRole(data.user.app_metadata.role)
    const next = getSafeNextPath(requestUrl.searchParams.get('next'), requestUrl.origin)
    return NextResponse.redirect(new URL(next ?? roleHome[role], requestUrl.origin))
  }

  if (isOAuth) {
    return NextResponse.redirect(new URL('/login?error=google', requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/reset-password?recovery=1', requestUrl.origin))
}
