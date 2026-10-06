import { NextResponse } from 'next/server'
import { createSupabaseServerClient, isSupabaseAuthConfigured } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    const errorUrl = new URL('/reset-password?error=invalid_link', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  if (!isSupabaseAuthConfigured()) {
    const errorUrl = new URL('/reset-password?error=configuration', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const errorUrl = new URL('/reset-password?error=invalid_link', requestUrl.origin)
    return NextResponse.redirect(errorUrl)
  }

  return NextResponse.redirect(new URL('/reset-password?recovery=1', requestUrl.origin))
}
