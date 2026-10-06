'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { roleHome, type Role } from '@sportcomplex/core'
import { loginSchema, registerSchema } from '@sportcomplex/validation'
import { Input } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'
import { TopBar } from '@/components/top-bar'
import { ActionButton } from '@/components/action-button'
import { GoogleMark } from '@/components/google-mark'

function getSafeNextPath() {
  const path = new URLSearchParams(window.location.search).get('next')
  return path && path.startsWith('/') && !path.startsWith('//') ? path : null
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const register = mode === 'register'
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // 1. Validación en cliente con los contratos Zod de @sportcomplex/validation
    const parsed = register
      ? registerSchema.safeParse({ name, email, password })
      : loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Por favor verifica los datos ingresados.')
      return
    }

    setLoading(true)
    try {
      let role: Role = 'Cliente'

      if (!register) {
        // 2. Login real contra /api/auth
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
        role = result.data.user.role
      }
      // TODO(register): llamar al endpoint de registro cuando exista (hoy fe-00 solo valida y redirige)

      // 3. Redirección: ?next= si es seguro; si no, la pantalla de inicio del rol
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
        <div className="auth-art">
          <div className="auth-art-content">
            <Brand light />
            <div className="auth-mantra">
              <div className="eyebrow hero-eyebrow">TU ESPACIO, TU MOMENTO</div>
              <h2>El movimiento<br />cambia <span>todo.</span></h2>
              <p>Bienvenido a una comunidad que se mueve contigo.</p>
              <div className="auth-decoration">
                <Activity size={152} strokeWidth={0.8} />
              </div>
            </div>
            <div className="auth-quote">“La mejor inversión es la que haces en ti.”</div>
          </div>
        </div>

        <div className="auth-form-side">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-form-wrap">
            <Link href="/" className="back-link">
              <ArrowLeft size={15} /> Volver al inicio
            </Link>
            <div className="eyebrow">{register ? 'EMPIEZA HOY' : 'QUÉ BUENO TENERTE DE VUELTA'}</div>
            <h1>{register ? 'Crea tu cuenta.' : 'Ingresa a tu espacio.'}</h1>
            <p className="auth-subtitle">
              {register ? 'Un paso más cerca de tu próxima aventura.' : 'Tu próximo momento de bienestar te espera.'}
            </p>

            <button type="button" className="google-button" disabled>
              <GoogleMark /> Continuar con Google
            </button>

            <div className="auth-divider">
              <span />o con tu correo<span />
            </div>

            <form className="auth-fields" onSubmit={submit} noValidate>
              {register && (
                <label>
                  Nombre completo
                  <Input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Tu nombre"
                    autoComplete="name"
                  />
                </label>
              )}
              <label>
                Correo electrónico
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
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
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                />
              </label>

              {!register && (
                <Link href="/forgot-password" className="forgot-link">
                  ¿Olvidaste tu contraseña?
                </Link>
              )}

              {error && (
                <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
                  {error}
                </p>
              )}

              <ActionButton type="submit" disabled={loading} className="w-full justify-center">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {register ? 'Crear mi cuenta' : 'Ingresar'} <ArrowRight size={16} />
              </ActionButton>
            </form>

            <div className="auth-switch">
              {register ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}{' '}
              <Link href={register ? '/login' : '/register'}>{register ? 'Ingresar' : 'Regístrate'}</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
