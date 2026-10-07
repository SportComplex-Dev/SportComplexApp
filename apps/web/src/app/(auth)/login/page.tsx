'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { signIn } from 'next-auth/react'
import { roleHome, type Role } from '@sportcomplex/core'
import { loginSchema } from '@sportcomplex/validation'
import { Input } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'
import { TopBar } from '@/components/top-bar'
import { ActionButton } from '@/components/action-button'
import { GoogleMark } from '@/components/google-mark'
import { createSupabaseBrowserClient, isSupabaseAuthConfigured } from '@/lib/supabase/browser'

const supportedRoles: Role[] = ['Administrador', 'Empleado_Vendedor', 'Empleado_Lector', 'Cliente']

function getUserRole(role: unknown): Role {
  return supportedRoles.find((supportedRole) => supportedRole === role) ?? 'Cliente'
}

function getSafeNextPath() {
  const path = new URLSearchParams(window.location.search).get('next')
  if (!path || !path.startsWith('/')) return null
  return new URL(path, window.location.origin).origin === window.location.origin ? path : null
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const authError = params.get('error')
    if (
      authError === 'google' ||
      authError === 'OAuthSignin' ||
      authError === 'OAuthCallback' ||
      authError === 'OAuthCreateAccount' ||
      authError === 'OAuthAccountNotLinked'
    ) {
      setError('No se pudo completar el acceso con Google. Inténtalo nuevamente.')
    } else if (authError === 'configuration' || authError === 'Configuration') {
      setError('El proveedor de autenticación todavía no está configurado.')
    } else if (authError) {
      setError('Ocurrió un error al iniciar sesión. Inténtalo nuevamente.')
    }

    if (!isSupabaseAuthConfigured()) {
      setCheckingSession(false)
      return
    }

    let active = true
    const supabase = createSupabaseBrowserClient()

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) {
        setError('No se pudo verificar tu sesión. Inténtalo nuevamente.')
        setCheckingSession(false)
        return
      }

      const user = data.session?.user
      if (user) {
        const role = getUserRole(user.app_metadata.role)
        router.replace(getSafeNextPath() ?? roleHome[role])
        router.refresh()
        return
      }

      setCheckingSession(false)
    }).catch(() => {
      if (active) {
        setError('No se pudo verificar tu sesión. Inténtalo nuevamente.')
        setCheckingSession(false)
      }
    })

    return () => {
      active = false
    }
  }, [router])

  const handleGoogleLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      await signIn('google', { redirectTo: getSafeNextPath() ?? '/' })
    } catch {
      setError('No se pudo iniciar sesión con Google. Inténtalo nuevamente.')
      setLoading(false)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // 1. Validación en cliente con el contrato Zod oficial
    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Por favor verifica los datos ingresados.')
      return
    }

    setLoading(true)
    try {
      // 2. Petición real al endpoint /api/auth
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const result = await res.json()

      if (!res.ok || !result.success) {
        setError(result.error?.message || 'Correo o contraseña incorrectos.')
        return
      }

      // 3. Redirección: ?next= si es una ruta interna segura; si no, el inicio del rol
      const role: Role = result.data.user.role
      router.push(getSafeNextPath() ?? roleHome[role])
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="club-app">
      <TopBar />
      <main className="auth-page">
        {/* Panel de marca (izquierda) */}
        <div className="auth-art">
          <div className="auth-art-content">
            <Brand light />
            <div className="auth-mantra">
              <div className="eyebrow hero-eyebrow">TU ESPACIO, TU MOMENTO</div>
              <h2>El movimiento<br />cambia <span>todo.</span></h2>
              <p>Bienvenido a una comunidad que se mueve contigo.</p>
              <div className="auth-decoration" aria-hidden="true">
                <Activity size={152} strokeWidth={0.8} aria-hidden="true" />
              </div>
            </div>
            <div className="auth-quote">“La mejor inversión es la que haces en ti.”</div>
          </div>
        </div>

        {/* Formulario (derecha) */}
        <div className="auth-form-side">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-form-wrap">
            <Link href="/" className="back-link">
              <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" /> Volver al inicio
            </Link>
            <div className="eyebrow">QUÉ BUENO TENERTE DE VUELTA</div>
            <h1>Ingresa a tu espacio.</h1>
            <p className="auth-subtitle">Tu próximo momento de bienestar te espera.</p>

            <button
              type="button"
              className="google-button"
              onClick={handleGoogleLogin}
              disabled={loading || checkingSession}
              aria-busy={loading}
            >
              {loading ? <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <GoogleMark />}
              {loading ? 'Conectando con Google…' : 'Continuar con Google'}
            </button>

            <div className="auth-divider">
              <span />o con tu correo<span />
            </div>

            <form className="auth-fields" onSubmit={handleSubmit} noValidate aria-busy={loading || checkingSession}>
              <label>
                Correo electrónico
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </label>
              <label>
                Contraseña
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'login-error' : undefined}
                  required
                />
              </label>

              <Link href="/forgot-password" className="forgot-link">
                ¿Olvidaste tu contraseña?
              </Link>

              {error && (
                <p id="login-error" role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
                  {error}
                </p>
              )}

              <ActionButton type="submit" disabled={loading || checkingSession} className="w-full justify-center">
                {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                Ingresar <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </ActionButton>
            </form>

            <div className="auth-switch">
              ¿Aún no tienes cuenta? <Link href="/register">Regístrate</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
