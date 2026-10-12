'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, Mail, RotateCw, CheckCircle2 } from 'lucide-react'
import { Brand } from '@/components/brand'

type VerificationTiming = {
  expiresAt: string
  resendAvailableAt: string
  serverNow: string
}

type VerificationTimingResponse = {
  success: true
  data: VerificationTiming
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isVerificationTiming(value: unknown): value is VerificationTimingResponse {
  if (!isRecord(value) || typeof value.data !== 'object' || value.data === null) {
    return false
  }

  const data = value.data as Record<string, unknown>
  return (
    value.success === true &&
    typeof data.expiresAt === 'string' &&
    Number.isFinite(Date.parse(data.expiresAt)) &&
    typeof data.resendAvailableAt === 'string' &&
    Number.isFinite(Date.parse(data.resendAvailableAt)) &&
    typeof data.serverNow === 'string' &&
    Number.isFinite(Date.parse(data.serverNow))
  )
}

function getApiErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === 'string') {
    return payload.error.message
  }
  return fallback
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white">Cargando...</div>}>
      <VerifyPageContent />
    </Suspense>
  )
}

function VerifyPageContent() {
  const searchParams = useSearchParams()

  const emailParam = searchParams.get('email') ?? ''
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [syncing, setSyncing] = useState(true)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [resendCooldown, setResendCooldown] = useState<number | null>(null)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])
  const expiresAtRef = useRef<number | null>(null)
  const resendAvailableAtRef = useRef<number | null>(null)

  useEffect(() => {
    document.title = 'Verificación de cuenta | AKROS'
  }, [])

  const applyServerTiming = useCallback((timing: VerificationTiming, requestStartedAt: number) => {
    const elapsedMs = performance.now() - requestStartedAt
    const serverNow = Date.parse(timing.serverNow)
    const now = performance.now()
    const expiresAt = now + Math.max(0, Date.parse(timing.expiresAt) - serverNow - elapsedMs)
    const resendAvailableAt = now + Math.max(0, Date.parse(timing.resendAvailableAt) - serverNow - elapsedMs)

    expiresAtRef.current = expiresAt
    resendAvailableAtRef.current = resendAvailableAt
    setTimeLeft(Math.ceil(Math.max(0, expiresAt - now) / 1000))
    setResendCooldown(Math.ceil(Math.max(0, resendAvailableAt - now) / 1000))
  }, [])

  useEffect(() => {
    if (!emailParam) {
      setError('Falta el correo asociado a la verificación. Vuelve al registro para intentarlo de nuevo.')
      setSyncing(false)
      return
    }

    const controller = new AbortController()
    const requestStartedAt = performance.now()

    void fetch(`/api/auth/verify?email=${encodeURIComponent(emailParam)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json()
        if (!response.ok || !isVerificationTiming(payload)) {
          throw new Error(getApiErrorMessage(payload, 'No se pudo consultar la vigencia del código.'))
        }
        applyServerTiming(payload.data, requestStartedAt)
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return
        setError(requestError instanceof Error ? requestError.message : 'No se pudo consultar la vigencia del código.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setSyncing(false)
      })

    return () => controller.abort()
  }, [applyServerTiming, emailParam, syncAttempt])

  useEffect(() => {
    const timer = setInterval(() => {
      const now = performance.now()
      if (expiresAtRef.current !== null) {
        setTimeLeft(Math.ceil(Math.max(0, expiresAtRef.current - now) / 1000))
      }
      if (resendAvailableAtRef.current !== null) {
        setResendCooldown(Math.ceil(Math.max(0, resendAvailableAtRef.current - now) / 1000))
      }
    }, 250)
    return () => clearInterval(timer)
  }, [])

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  // Manejo de entrada celda por celda para el código de 6 dígitos
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.slice(-1)
    setCode(newCode)
    setError(null)

    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    if (!/^\d+$/.test(pasted)) return

    const digits = pasted.slice(0, 6).split('')
    const newCode = [...code]
    digits.forEach((digit, i) => {
      newCode[i] = digit
    })
    setCode(newCode)

    const nextIndex = Math.min(digits.length, 5)
    inputsRef.current[nextIndex]?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const token = code.join('')
    if (token.length < 6) {
      setError('Por favor ingresa los 6 dígitos del código.')
      return
    }

    if (syncing || expiresAtRef.current === null || performance.now() >= expiresAtRef.current) {
      setTimeLeft(0)
      setError('El token ha expirado. Por favor solicita un nuevo código.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, code: token }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok || !isRecord(payload) || payload.success !== true) {
        throw new Error(getApiErrorMessage(payload, 'No se pudo verificar el código. Inténtalo nuevamente.'))
      }

      setVerified(true)
      setCode(['', '', '', '', '', ''])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Código de verificación incorrecto.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (syncing || loading || resendAvailableAtRef.current === null || performance.now() < resendAvailableAtRef.current) return

    setError(null)
    setLoading(true)
    const requestStartedAt = performance.now()

    try {
      const response = await fetch('/api/auth/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok || !isVerificationTiming(payload)) {
        throw new Error(getApiErrorMessage(payload, 'No se pudo reenviar el código. Inténtalo nuevamente.'))
      }

      applyServerTiming(payload.data, requestStartedAt)
      setCode(['', '', '', '', '', ''])
      inputsRef.current[0]?.focus()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el código. Inténtalo nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-white font-sans antialiased text-neutral-900">
      <aside className="auth-art verify-auth-art relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0d3b2e] p-12 text-white lg:flex lg:p-16">
        <div className="relative z-10">
          <Brand light />
        </div>

        <div className="z-10 my-auto py-10">
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#bef264]">
            SEGURIDAD Y ACCESO
          </span>
          <h2 className="mt-4 text-5xl font-black leading-[1.1] tracking-tight text-white xl:text-6xl">
            Verifica tu<br />cuenta en <span className="text-[#bef264]">segundos.</span>
          </h2>
          <p className="mt-4 max-w-sm text-base font-normal leading-relaxed text-emerald-100/70">
            Protegemos tus reservas y transacciones garantizando un acceso seguro.
          </p>
        </div>

        <div className="verify-auth-decoration" aria-hidden="true">
          <img src="/images/Akros-full-logo.png" alt="" width="360" height="240" />
        </div>

        <div className="z-10 text-xs italic text-emerald-200/50">
          “Tu seguridad es parte del rendimiento.”
        </div>
      </aside>

      {/* Columna derecha: Formulario de código */}
      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12 lg:px-20">
        <div className="w-full max-w-md">
          {/* Volver */}
          <div className="mb-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 transition hover:text-neutral-900"
            >
              <ArrowLeft size={14} /> Volver a iniciar sesión
            </Link>
          </div>

          {/* Encabezado */}
          <div className="mb-7">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#0d3b2e]">
              <Mail size={24} />
            </div>
            
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
              Revisa tu correo.
            </h1>
            <p className="mt-1.5 text-xs text-neutral-500 leading-relaxed">
              Hemos enviado un código numérico de 6 dígitos a{' '}
              <strong className="text-neutral-800">{emailParam || 'tu correo'}</strong>.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
              {error}
              {!syncing && timeLeft === null && emailParam && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setSyncing(true)
                    setSyncAttempt((attempt) => attempt + 1)
                  }}
                  className="ml-2 font-bold underline"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {verified ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-2" />
              <h3 className="text-sm font-bold text-emerald-950">¡Cuenta verificada con éxito!</h3>
              <p className="text-xs text-emerald-700 mt-1">Ya puedes iniciar sesión con tu correo y contraseña.</p>
              <Link
                href="/login"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0d3b2e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14513f]"
              >
                Ir a iniciar sesión <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Inputs de 6 celdas numéricas */}
              <div className="flex justify-between gap-2 sm:gap-3">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputsRef.current[index] = el
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    disabled={syncing || loading || timeLeft === null || timeLeft <= 0}
                    aria-label={`Dígito ${index + 1} del código de verificación`}
                    className="h-13 w-12 sm:h-14 sm:w-14 rounded-xl border border-neutral-200 bg-[#f9fafb] text-center text-xl font-bold text-neutral-900 outline-none transition focus:border-neutral-900 focus:bg-white focus:ring-1 focus:ring-neutral-900"
                  />
                ))}
              </div>

              {/* Temporizador de expiración */}
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Vigencia del código:</span>
                <span
                  className={`font-semibold ${
                    timeLeft !== null && timeLeft < 120 ? 'text-red-500' : 'text-neutral-900'
                  }`}
                >
                  {syncing || timeLeft === null ? '--:--' : formatTimer(timeLeft)}
                </span>
              </div>

              {/* Botón principal */}
              <button
                type="submit"
                disabled={syncing || loading || timeLeft === null || timeLeft <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#bef264] py-3.5 text-sm font-bold text-neutral-950 shadow-sm transition hover:bg-[#aee74e] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? 'Verificando...' : 'Confirmar código'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {!verified && (
            <div className="mt-8 text-center text-xs text-neutral-500">
              ¿No recibiste el correo?{' '}
              <button
                type="button"
                onClick={handleResend}
                disabled={syncing || loading || resendCooldown === null || resendCooldown > 0 || !emailParam}
                className={`inline-flex items-center gap-1.5 font-semibold transition ${
                  syncing || resendCooldown === null || resendCooldown > 0 || loading
                    ? 'cursor-not-allowed text-neutral-400'
                    : 'text-neutral-950 hover:underline'
                }`}
              >
                <RotateCw size={12} className={resendCooldown !== null && resendCooldown > 0 ? 'animate-spin' : ''} />
                {syncing || resendCooldown === null
                  ? 'Sincronizando…'
                  : resendCooldown > 0
                    ? `Reenviar código (${resendCooldown}s)`
                    : 'Reenviar código'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}