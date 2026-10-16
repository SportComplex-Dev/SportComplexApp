'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  showPasswordToggle?: boolean | undefined
}

/**
 * TSK-FE-32: Soporte nativo para botón de visibilidad interactivo (ver/ocultar)
 * con iconos Eye y EyeOff de lucide-react y accesibilidad WCAG (tabIndex={-1}).
 */
export function Input({
  className,
  type = 'text',
  showPasswordToggle = true,
  ...props
}: InputProps) {
  const isPassword = type === 'password'
  const [showPassword, setShowPassword] = useState(false)

  const effectiveType = isPassword && showPassword ? 'text' : type

  if (isPassword && showPasswordToggle) {
    return (
      <div className="relative w-full flex items-center">
        <input
          type={effectiveType}
          data-slot="input"
          className={cn(
            'h-11 w-full rounded-lg border border-border bg-transparent px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          className="absolute right-3 p-1 rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors cursor-pointer"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  }

  return (
    <input
      type={effectiveType}
      data-slot="input"
      className={cn(
        'h-11 w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
