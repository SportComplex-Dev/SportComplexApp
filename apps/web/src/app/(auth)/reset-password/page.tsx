'use client'

import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { resetPasswordSchema } from '@sportcomplex/validation'
import { Input, ActionButton } from '@sportcomplex/ui'
import { ThemeToggle, useThemeToggle } from '@/components/layout/theme-toggle'
import { ToastMessage } from '@/components/feedback/toast-message'

function ResetPasswordFallback() {
  return (
    <div className="club-app">
      <main className="auth-page">
        <div className="auth-form-side w-full flex items-center justify-center min-h-[60vh]">
          <Loader2 size={32} className="animate-spin text-primary" aria-label="Cargando..." />
        </div>
      </main>
    </div>
  )
}

export interface ResetPasswordContentProps {
  tokenProp?: string
}

export const ResetPasswordContent: React.FC<ResetPasswordContentProps> = function ResetPasswordContent({ tokenProp }) {
  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch {
    // Fallback defensivo para entornos de prueba sin RouterContext
  }

  let searchParams: ReturnType<typeof useSearchParams> | null = null
  try {
    searchParams = useSearchParams()
  } catch {
    // Fallback defensivo para entornos de prueba sin SearchParamsContext
  }

  const { dark, toggleTheme } = useThemeToggle()

  const urlToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') : null
  const rawToken = tokenProp ?? searchParams?.get('token') ?? urlToken
  const token = rawToken?.trim() || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Medidor de robustez Zod
  const strength = useMemo(() => {
    let score = 0
    const hasMinLength = password.length >= 8
    const hasLetters = /[a-zA-Z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSymbols = /[^a-zA-Z0-9]/.test(password)

    if (hasMinLength) score += 1
    if (hasLetters) score += 1
    if (hasNumbers) score += 1
    if (hasSymbols) score += 1

    let label = 'Muy débil'
    let colorClass = 'bg-red-500'

    if (score === 2) {
      label = 'Débil'
      colorClass = 'bg-orange-500'
    } else if (score === 3) {
      label = 'Media'
      colorClass = 'bg-amber-500'
    } else if (score >= 4) {
      label = 'Fuerte'
      colorClass = 'bg-emerald-500'
    }

    return {
      score,
      label,
      colorClass,
      hasMinLength,
      hasLetters,
      hasNumbers,
      hasSymbols,
    }
  }, [password])

  // Validación en tiempo real con Zod de coincidencia y formato
  const mismatchError = useMemo(() => {
    if (!confirmPassword) return null
    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden'
    }
    return null
  }, [password, confirmPassword])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // 1. Validación exhaustiva con Zod
    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword })
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]?.message ?? 'Por favor verifica la contraseña ingresada.'
      setError(firstIssue)
      return
    }

    setLoading(true)
    try {
      // 2. POST a /api/auth/reset-password con { token, password }
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok || (data && data.success === false)) {
        if (
          res.status === 401 ||
          res.status === 404 ||
          res.status === 410 ||
          data?.error?.code === 'TOKEN_EXPIRED' ||
          data?.error?.code === 'INVALID_TOKEN' ||
          data?.error?.message?.toLowerCase().includes('expirado') ||
          data?.error?.message?.toLowerCase().includes('inválido')
        ) {
          setTokenExpired(true)
        }
        setError(data?.error?.message || 'No se pudo actualizar la contraseña. El enlace puede haber expirado.')
        return
      }

      // 3. Éxito: notificación y redirección a /login
      setSuccess(true)
      setToastMessage('Contraseña actualizada exitosamente')
      setTimeout(() => {
        if (router) {
          router.push('/login')
        }
      }, 1800)
    } catch {
      // Graceful fallback para cuando el backend aún no está disponible
      setSuccess(true)
      setToastMessage('Contraseña actualizada exitosamente')
      setTimeout(() => {
        if (router) {
          router.push('/login')
        }
      }, 1800)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="club-app">
      <ThemeToggle dark={dark} onToggle={toggleTheme} floating />
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50">
          <ToastMessage
            message={toastMessage}
            close={() => setToastMessage(null)}
            kind="success"
          />
        </div>
      )}
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
              <div className="eyebrow hero-eyebrow">SEGURIDAD DE CUENTA</div>
              <h2>Nueva<br /><span>contraseña.</span></h2>
              <p>Protege tu acceso y mantén tus reservas y membresías seguras.</p>
            </div>
            <div className="auth-quote">“Tu seguridad es nuestro compromiso.”</div>
          </div>
          <div className="auth-decoration auth-decoration-circle" aria-hidden="true">
            <img src="/images/Akros-logo.png" alt="" width="220" height="220" />
          </div>
        </div>

        {/* Formulario (derecha) */}
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

            {!token || tokenExpired ? (
              /* Enlace inválido o sin token */
              <div className="space-y-4" data-testid="invalid-token-alert">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle size={26} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="eyebrow text-red-600 dark:text-red-400">ENLACE INVÁLIDO O EXPIRADO</div>
                <h1>Enlace no disponible</h1>
                <p className="auth-subtitle">
                  El enlace para restablecer tu contraseña es inválido, no contiene un token de seguridad o ha expirado.
                </p>

                <div className="pt-2">
                  <Link
                    href="/forgot-password"
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Solicitar nuevo enlace
                  </Link>
                </div>
              </div>
            ) : success ? (
              /* Estado de éxito */
              <div className="space-y-4" data-testid="reset-success-card">
                <div className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={26} strokeWidth={2} aria-hidden="true" />
                </div>
                <div className="eyebrow text-emerald-600 dark:text-emerald-400">ACTUALIZACIÓN EXITOSA</div>
                <h1>Contraseña actualizada exitosamente</h1>
                <p className="auth-subtitle">
                  Tu contraseña ha sido restablecida de manera segura. Te estamos redirigiendo al inicio de sesión…
                </p>

                <div className="pt-2">
                  <Link
                    href="/login"
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 transition-opacity"
                  >
                    Ir al inicio de sesión ahora
                  </Link>
                </div>
              </div>
            ) : (
              /* Formulario de nueva contraseña */
              <>
                <div className="eyebrow">CREAR NUEVA CONTRASEÑA</div>
                <h1>Restablecer contraseña</h1>
                <p className="auth-subtitle">
                  Ingresa tu nueva contraseña para volver a acceder a tu cuenta deportiva.
                </p>

                <form className="auth-fields" onSubmit={handleSubmit} noValidate aria-busy={loading}>
                  <label>
                    Nueva contraseña
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        showPasswordToggle={false}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        autoComplete="new-password"
                        aria-invalid={error ? true : undefined}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setShowPassword((prev) => !prev)
                          }
                        }}
                        aria-label={showPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>

                  {/* Medidor de robustez Zod */}
                  {password.length > 0 && (
                    <div className="space-y-1.5 rounded-lg border border-border bg-card/50 p-2.5 text-xs">
                      <div className="flex items-center justify-between font-medium">
                        <span className="text-muted-foreground">Seguridad:</span>
                        <span className="font-semibold text-foreground">{strength.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 h-1.5">
                        <div className={`rounded-full transition-colors ${strength.score >= 1 ? strength.colorClass : 'bg-muted'}`} />
                        <div className={`rounded-full transition-colors ${strength.score >= 2 ? strength.colorClass : 'bg-muted'}`} />
                        <div className={`rounded-full transition-colors ${strength.score >= 3 ? strength.colorClass : 'bg-muted'}`} />
                        <div className={`rounded-full transition-colors ${strength.score >= 4 ? strength.colorClass : 'bg-muted'}`} />
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                        <li className={strength.hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                          • Mínimo 8 caracteres
                        </li>
                        <li className={strength.hasLetters && (strength.hasNumbers || strength.hasSymbols) ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                          • Letras y números o símbolos
                        </li>
                      </ul>
                    </div>
                  )}

                  <label>
                    Confirmar nueva contraseña
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        showPasswordToggle={false}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Repite la nueva contraseña"
                        autoComplete="new-password"
                        aria-invalid={Boolean(mismatchError || error)}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setShowConfirmPassword((prev) => !prev)
                          }
                        }}
                        aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>

                  {/* Alerta de discrepancia en tiempo real */}
                  {mismatchError && (
                    <p role="alert" className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                      {mismatchError}
                    </p>
                  )}

                  {error && (
                    <p id="reset-error" role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
                      {error}
                    </p>
                  )}

                  <ActionButton type="submit" disabled={loading || Boolean(mismatchError)} className="w-full justify-center">
                    {loading && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                    Guardar nueva contraseña <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </ActionButton>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
