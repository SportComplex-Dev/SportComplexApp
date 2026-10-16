'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { forgotPasswordSchema } from '@sportcomplex/validation'
import { Input, ActionButton } from '@sportcomplex/ui'
import { ThemeToggle, useThemeToggle } from '@/components/layout/theme-toggle'

export default function ForgotPasswordPage() {
  const { dark, toggleTheme } = useThemeToggle()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // 1. Validación en cliente con Zod oficial
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Ingresa un correo electrónico válido.')
      return
    }

    setLoading(true)
    try {
      // 2. Llamada fetch POST a /api/auth/forgot-password
      // Manejado gracefully si el backend no está disponible o responde error
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      }).catch(() => null)

      // 3. Confirmación visible siempre para seguridad
      setSubmitted(true)
    } catch {
      // Graceful fallback sin romper la UI
      setSubmitted(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="club-app">
      <ThemeToggle dark={dark} onToggle={toggleTheme} floating />
      <main className="auth-page">
        {/* Panel de marca (izquierda) */}
        <div className="auth-art">
          <div className="auth-art-content">
            <div className="flex items-center gap-2.5 select-none text-white">
              <img src="/images/Akros-logo.png" alt="AKROS Active Lifestyle Club" width="40" height="32" className="object-contain" />
              <div className="flex flex-col leading-none">
                <span className="text-[19px] font-black tracking-[0.08em]">AKROS</span>
                <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase opacity-80">CLUB</span>
              </div>
            </div>
            <div className="auth-mantra">
              <div className="eyebrow hero-eyebrow">RECUPERACIÓN SEGURA</div>
              <h2>Recupera<br />tu <span>acceso.</span></h2>
              <p>Te enviaremos los pasos para restablecer tu contraseña y continuar con tu bienestar.</p>
            </div>
            <div className="auth-quote">“Tu constancia define tus resultados.”</div>
          </div>
          <div className="auth-decoration auth-decoration-circle" aria-hidden="true">
            <img src="/images/Akros-logo.png" alt="" width="220" height="220" />
          </div>
        </div>

        {/* Formulario / Confirmación (derecha) */}
        <div className="auth-form-side">
          <div className="auth-mobile-brand">
            <div className="flex items-center gap-2.5 select-none">
              <img src="/images/Akros-logo.png" alt="AKROS Active Lifestyle Club" width="40" height="32" className="object-contain" />
              <div className="flex flex-col leading-none">
                <span className="text-[19px] font-black tracking-[0.08em]">AKROS</span>
                <span className="text-[9px] font-extrabold tracking-[0.18em] uppercase opacity-80">CLUB</span>
              </div>
            </div>
          </div>
          <div className="auth-form-wrap">
            <Link href="/login" className="back-link">
              <ArrowLeft size={15} strokeWidth={1.75} aria-hidden="true" /> Volver al inicio de sesión
            </Link>

            {submitted ? (
              <div className="space-y-4" data-testid="forgot-password-success">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={26} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="eyebrow text-emerald-600 dark:text-emerald-400">CORREO ENVIADO</div>
                <h1>Revisa tu bandeja de entrada</h1>
                <p className="auth-subtitle">
                  Hemos enviado las instrucciones para restablecer tu contraseña a{' '}
                  <span className="font-semibold text-foreground">{email}</span>. Si no lo encuentras, revisa tu carpeta de spam o correo no deseado.
                </p>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Volver al login
                  </Link>
                </div>

                <div className="auth-switch text-center">
                  ¿No recibiste el correo?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false)
                      setError(null)
                    }}
                    className="cursor-pointer font-bold underline"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="eyebrow">RECUPERAR CONTRASEÑA</div>
                <h1>¿Olvidaste tu contraseña?</h1>
                <p className="auth-subtitle">
                  Ingresa tu correo electrónico registrado y te enviaremos un enlace seguro para restablecerla.
                </p>

                <form className="auth-fields" onSubmit={handleSubmit} noValidate aria-busy={loading}>
                  <label>
                    Correo electrónico
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="nombre@correo.com"
                      autoComplete="email"
                      aria-invalid={error ? true : undefined}
                      aria-describedby={error ? 'forgot-error' : undefined}
                      required
                    />
                  </label>

                  {error && (
                    <p id="forgot-error" role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
                      {error}
                    </p>
                  )}

                  <ActionButton type="submit" disabled={loading} className="w-full justify-center">
                    {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                    Enviar instrucciones <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </ActionButton>
                </form>

                <div className="auth-switch">
                  ¿Recordaste tu contraseña?{' '}
                  <Link href="/login">
                    Ingresar
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
