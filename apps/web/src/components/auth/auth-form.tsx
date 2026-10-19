'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Loader2 } from 'lucide-react'
import { loginSchema } from '@sportcomplex/validation'
import { Input, ActionButton } from '@sportcomplex/ui'

export interface AuthFormProps {
  onSubmit?: (data: { email: string; password: string }) => Promise<void> | void
  loading?: boolean
  error?: string | null
}

export function AuthForm({ onSubmit, loading: externalLoading = false, error: externalError = null }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isSubmitting = externalLoading || loading
  const displayError = externalError || error

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Por favor verifica los datos ingresados.')
      return
    }

    if (onSubmit) {
      try {
        setLoading(true)
        await onSubmit(parsed.data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al conectar con el servidor.')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <form className="auth-fields" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
      <label>
        Correo electrónico
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nombre@correo.com"
          autoComplete="email"
          aria-invalid={displayError ? true : undefined}
          aria-describedby={displayError ? 'auth-form-error' : undefined}
          required
        />
      </label>

      <label>
        <div className="flex items-center justify-between">
          <span>Contraseña</span>
          <Link href="/forgot-password" className="forgot-link text-xs">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Mínimo 6 caracteres"
          autoComplete="current-password"
          aria-invalid={displayError ? true : undefined}
          aria-describedby={displayError ? 'auth-form-error' : undefined}
          required
        />
      </label>

      {displayError && (
        <p id="auth-form-error" role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-600">
          {displayError}
        </p>
      )}

      <ActionButton type="submit" disabled={isSubmitting} className="w-full justify-center">
        {isSubmitting && <Loader2 size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
        Ingresar <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
      </ActionButton>
    </form>
  )
}

export default AuthForm
