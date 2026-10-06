'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { forgotPasswordSchema } from '@sportcomplex/validation'
import { Input } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'
import { TopBar } from '@/components/top-bar'
import { ActionButton } from '@/components/action-button'

type Status = 'idle' | 'sending' | 'success' | 'error'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  const reset = () => {
    setStatus('idle')
    setServerError(null)
    setFieldError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFieldError(null)
    setServerError(null)

    // Validación en cliente
    const parsed = forgotPasswordSchema.safeParse({ email })
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
      return
    }

    setStatus('sending')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      const result: { success?: boolean; error?: { message?: string } } = await res.json()

      if (!res.ok || !result.success) {
        setServerError(result.error?.message || 'Algo salió mal. Intenta de nuevo.')
        setStatus('error')
        return
      }

      setStatus('success')
    } catch {
      setServerError('No se pudo conectar con el servidor. Verifica tu conexión.')
      setStatus('error')
    }
  }

  return (
    <div className="club-app">
      <TopBar />
      <main className="auth-page">

        {/* Panel izquierdo decorativo — idéntico al de AuthForm */}
        <div className="auth-art">
          <div className="auth-art-content">
            <Brand light />
            <div className="auth-mantra">
              <div className="eyebrow hero-eyebrow">RECUPERA TU ACCESO</div>
              <h2>Sin contraseña,<br />sin <span>problema.</span></h2>
              <p>Te enviaremos un enlace para restablecer tu contraseña.</p>
              <div className="auth-decoration">
                <Activity size={152} strokeWidth={0.8} />
              </div>
            </div>
            <div className="auth-quote">"Un nuevo comienzo está a un clic de distancia."</div>
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="auth-form-side">
          <div className="auth-mobile-brand"><Brand /></div>
          <div className="auth-form-wrap">

            <Link href="/login" className="back-link">
              <ArrowLeft size={15} /> Volver al inicio de sesión
            </Link>

            {/* ── Estado: ÉXITO ── */}
            {status === 'success' && (
              <>
                <div className="eyebrow">LISTO</div>
                <h1>Revisa tu correo.</h1>
                <p className="auth-subtitle">
                  Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña en los próximos minutos.
                </p>
                <div className="forgot-success">
                  <div className="forgot-success-icon">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <h3>Solicitud enviada</h3>
                    <p>Revisa tu correo y también la carpeta de spam.</p>
                  </div>
                </div>
                <div className="auth-switch" style={{ marginTop: '24px' }}>
                  ¿No llegó?{' '}
                  <button type="button" onClick={reset}>
                    Intentar con otro correo
                  </button>
                </div>
              </>
            )}

            {/* ── Estado: ERROR DE SERVIDOR ── */}
            {status === 'error' && (
              <>
                <div className="eyebrow">ALGO SALIÓ MAL</div>
                <h1>Ups, intenta de nuevo.</h1>
                <p className="auth-subtitle">
                  Ocurrió un problema al procesar tu solicitud.
                </p>
                <div className="forgot-error">
                  <div className="forgot-error-icon">
                    <XCircle size={26} />
                  </div>
                  <div>
                    <h3>Error al enviar</h3>
                    <p>{serverError}</p>
                  </div>
                </div>
                <ActionButton
                  onClick={reset}
                  className="w-full justify-center"
                  style={{ marginTop: '20px' }}
                >
                  Intentar de nuevo <ArrowRight size={16} />
                </ActionButton>
              </>
            )}

            {/* ── Estado: IDLE / ENVIANDO ── */}
            {(status === 'idle' || status === 'sending') && (
              <>
                <div className="eyebrow">RECUPERAR CONTRASEÑA</div>
                <h1>¿Olvidaste tu contraseña?</h1>
                <p className="auth-subtitle">
                  Ingresa tu correo y te enviaremos un enlace para restablecerla.
                </p>

                <form className="auth-fields" onSubmit={submit} noValidate>
                  <label>
                    Correo electrónico
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (fieldError) setFieldError(null)
                      }}
                      placeholder="nombre@correo.com"
                      autoComplete="email"
                      required
                      disabled={status === 'sending'}
                      aria-invalid={!!fieldError}
                      aria-describedby={fieldError ? 'email-error' : undefined}
                    />
                  </label>

                  {fieldError && (
                    <p
                      id="email-error"
                      role="alert"
                      className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600"
                    >
                      {fieldError}
                    </p>
                  )}

                  <ActionButton
                    type="submit"
                    disabled={status === 'sending'}
                    className="w-full justify-center"
                  >
                    {status === 'sending' ? (
                      <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                    ) : (
                      <>Enviar enlace <ArrowRight size={16} /></>
                    )}
                  </ActionButton>
                </form>

                <div className="auth-switch">
                  ¿Recordaste tu contraseña?{' '}
                  <Link href="/login">Ingresar</Link>
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
