'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Activity, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { roleHome, type Role } from '@sportcomplex/core'
import { registerSchema } from '@sportcomplex/validation'
import { Input } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'
import { TopBar } from '@/components/top-bar'
import { ActionButton } from '@/components/action-button'
import { GoogleMark } from '@/components/google-mark'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // 1. Validación en cliente con el contrato Zod oficial
    const parsed = registerSchema.safeParse({ name, email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Por favor verifica los datos ingresados.')
      return
    }

    // 2. Habeas Data (Ley 1581 de 2012): consentimiento explícito, casilla sin premarcar
    if (!accepted) {
      setError('Debes aceptar la Política de Tratamiento de Datos Personales para continuar.')
      return
    }

    setLoading(true)
    try {
      // TODO(RF-02): crear la cuenta en estado Pendiente, enviar el token de 15 min y llevar a /verify.
      // Hoy (igual que fe-00) solo valida y redirige al inicio del rol Cliente.
      const role: Role = 'Cliente'
      const next = new URLSearchParams(window.location.search).get('next')
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null
      router.push(safeNext ?? roleHome[role])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar la cuenta.')
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
            <div className="eyebrow">EMPIEZA HOY</div>
            <h1>Crea tu cuenta.</h1>
            <p className="auth-subtitle">Un paso más cerca de tu próxima aventura.</p>

            <button type="button" className="google-button" disabled title="Próximamente">
              <GoogleMark /> Continuar con Google
            </button>

            <div className="auth-divider">
              <span />o con tu correo<span />
            </div>

            <form className="auth-fields" onSubmit={handleSubmit} noValidate aria-busy={loading}>
              <label>
                Nombre completo
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'register-error' : undefined}
                  required
                />
              </label>
              <label>
                Correo electrónico
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'register-error' : undefined}
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
                  autoComplete="new-password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'register-error' : undefined}
                  required
                />
              </label>

              <label className="flex-row! items-start! gap-2.5! text-[12px]! font-medium! leading-relaxed">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-0.5! size-4! shrink-0 cursor-pointer p-0! accent-[#123e30]"
                  required
                />
                <span>
                  Acepto la{' '}
                  <Link href="/legal" target="_blank" rel="noopener noreferrer" className="font-bold underline">
                    Política de Tratamiento de Datos Personales
                  </Link>
                  .
                </span>
              </label>

              {error && (
                <p id="register-error" role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
                  {error}
                </p>
              )}

              <ActionButton type="submit" disabled={loading} className="w-full justify-center">
                {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                Crear mi cuenta <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </ActionButton>
            </form>

            <div className="auth-switch">
              ¿Ya tienes cuenta? <Link href="/login">Ingresar</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
