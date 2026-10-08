'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, ArrowLeft, ArrowRight, Mail, RotateCw, CheckCircle2 } from 'lucide-react'
import { roleHome, type Role } from '@sportcomplex/core'

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-white">Cargando...</div>}>
      <VerifyPageContent />
    </Suspense>
  )
}

function VerifyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const emailParam = searchParams.get('email') || 'tu correo'
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 minutos (900 segundos) según RF-02

  // Estado para el temporizador de 60 segundos del botón de reenvío
  const [resendCooldown, setResendCooldown] = useState(60)

  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  // Temporizador de 15 minutos (RF-02)
  useEffect(() => {
    if (timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [timeLeft])

  // Temporizador regresivo de 60 segundos para el botón de reenvío
  useEffect(() => {
    if (resendCooldown <= 0) return
    const cooldownTimer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(cooldownTimer)
  }, [resendCooldown])

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

    if (timeLeft <= 0) {
      setError('El token ha expirado. Por favor solicita un nuevo código.')
      return
    }

    setLoading(true)
    try {
      setVerified(true)
      setTimeout(() => {
        const role: Role = 'Cliente'
        router.push(roleHome[role])
      }, 1500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Código de verificación incorrecto.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = () => {
    if (resendCooldown > 0) return

    setTimeLeft(900)
    setResendCooldown(60)
    setCode(['', '', '', '', '', ''])
    setError(null)
    inputsRef.current[0]?.focus()
  }

  return (
    <div className="flex min-h-screen w-full bg-white font-sans antialiased text-neutral-900">
      {/* Columna lateral izquierda (Verde deportivo con ondas concéntricas) */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#0d3b2e] p-12 text-white lg:flex lg:p-16">
        <div className="z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#bef264] text-neutral-950 shadow-sm">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">SportComplex</span>
        </div>

        <div className="z-10 my-auto py-10">
          <span className="text-[11px] font-bold tracking-widest uppercase text-[#bef264]">
            SEGURIDAD Y ACCESO
          </span>
          <h2 className="mt-4 text-5xl font-black leading-[1.1] tracking-tight text-white xl:text-6xl">
            Verifica tu<br />cuenta en <span className="text-[#bef264]">segundos.</span>
          </h2>
          <p className="mt-4 text-base font-normal leading-relaxed text-emerald-100/70 max-w-sm">
            Protegemos tus reservas y transacciones garantizando un acceso seguro.
          </p>
        </div>

        {/* Ondas concéntricas de fondo */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute h-[520px] w-[520px] rounded-full border border-white/5 opacity-40" />
          <div className="absolute h-[380px] w-[380px] rounded-full border border-white/10 opacity-30" />
          <div className="absolute h-[240px] w-[240px] rounded-full border border-white/10 opacity-20" />
          <Activity size={220} strokeWidth={0.8} className="text-[#bef264] opacity-20" />
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
              <strong className="text-neutral-800">{emailParam}</strong>.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          {verified ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-2" />
              <h3 className="text-sm font-bold text-emerald-950">¡Cuenta verificada con éxito!</h3>
              <p className="text-xs text-emerald-700 mt-1">Redirigiendo a tu espacio...</p>
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
                    className="h-13 w-12 sm:h-14 sm:w-14 rounded-xl border border-neutral-200 bg-[#f9fafb] text-center text-xl font-bold text-neutral-900 outline-none transition focus:border-neutral-900 focus:bg-white focus:ring-1 focus:ring-neutral-900"
                  />
                ))}
              </div>

              {/* Temporizador de expiración */}
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Vigencia del código:</span>
                <span
                  className={`font-semibold ${
                    timeLeft < 120 ? 'text-red-500' : 'text-neutral-900'
                  }`}
                >
                  {formatTimer(timeLeft)}
                </span>
              </div>

              {/* Botón principal */}
              <button
                type="submit"
                disabled={loading || timeLeft <= 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#bef264] py-3.5 text-sm font-bold text-neutral-950 shadow-sm transition hover:bg-[#aee74e] active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? 'Verificando...' : 'Confirmar código'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* Reenviar código con bloqueo de 60s */}
          <div className="mt-8 text-center text-xs text-neutral-500">
            ¿No recibiste el correo?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className={`inline-flex items-center gap-1.5 font-semibold transition ${
                resendCooldown > 0
                  ? 'cursor-not-allowed text-neutral-400'
                  : 'text-neutral-950 hover:underline'
              }`}
            >
              <RotateCw size={12} className={resendCooldown > 0 ? 'animate-spin' : ''} />
              {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : 'Reenviar código'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}