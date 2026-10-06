'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Input } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'

type ResetPasswordFormProps = { isSupabaseRecovery: boolean; initialError?: string }

export function ResetPasswordForm({ isSupabaseRecovery, initialError }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>(initialError ? 'error' : 'idle')
  const [message, setMessage] = useState<string | null>(
    initialError
      ? initialError === 'configuration'
        ? 'No se pudo completar la recuperación. Intenta de nuevo más tarde.'
        : 'El enlace no es válido o ya expiró. Solicita uno nuevo.'
      : null,
  )

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    setMessage(null)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const result: { success?: boolean; data?: { message?: string }; error?: { message?: string } } =
        await response.json()

      if (!response.ok || !result.success) {
        setMessage(result.error?.message ?? 'No se pudo actualizar la contraseña.')
        setStatus('error')
        return
      }

      setMessage(result.data?.message ?? 'La contraseña se actualizó correctamente.')
      setStatus('success')
    } catch {
      setMessage('No se pudo conectar con el servidor. Intenta de nuevo.')
      setStatus('error')
    }
  }

  return (
    <div className="club-app">
      <main className="auth-page">
        <div className="auth-form-side" style={{ gridColumn: '1 / -1' }}>
          <div className="auth-form-wrap">
            <Link href="/login" className="back-link">
              <ArrowLeft size={15} /> Volver al inicio de sesión
            </Link>
            <div className="eyebrow">RECUPERAR CONTRASEÑA</div>
            <h1>Define una nueva contraseña.</h1>

            {initialError ? (
              <p className="auth-subtitle" role="alert">{message}</p>
            ) : !isSupabaseRecovery ? (
              <p className="auth-subtitle" role="alert">El enlace de recuperación no es válido.</p>
            ) : status === 'success' ? (
              <>
                <p className="auth-subtitle" role="status">{message}</p>
                <Link href="/login" className="action-button w-full justify-center">
                  Ir a iniciar sesión <ArrowRight size={16} />
                </Link>
              </>
            ) : (
              <>
                <p className="auth-subtitle">Escribe una contraseña nueva para tu cuenta.</p>
                <form className="auth-fields" onSubmit={submit} noValidate>
                  <label>
                    Nueva contraseña
                    <Input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      minLength={6}
                      required
                      disabled={status === 'sending'}
                    />
                  </label>
                  {message && <p role="alert" className="text-[13px] font-semibold text-red-600">{message}</p>}
                  <ActionButton type="submit" disabled={status === 'sending'} className="w-full justify-center">
                    {status === 'sending' && <Loader2 size={16} className="animate-spin" />}
                    Actualizar contraseña <ArrowRight size={16} />
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
