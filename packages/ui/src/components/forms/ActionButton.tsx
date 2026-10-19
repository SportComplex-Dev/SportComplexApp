'use client'

import React, { useState } from 'react'
import { Button, cn, type ButtonProps } from '@sportcomplex/ui'

export interface ActionButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  secondary?: boolean
  danger?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  isSubmitting?: boolean
  onClick?: (
    event: React.MouseEvent<HTMLButtonElement>
  ) => void | Promise<unknown>
}

/**
 * ActionButton Component (TSK-FE-38)
 *
 * Botón de acción con protección contra doble clic y estado de carga visual:
 * 1. Soporta control explícito mediante prop `isSubmitting`.
 * 2. Soporta protección automática para handlers asíncronos (`Promise`).
 * 3. Delega el spinner y accesibilidad (aria-busy, aria-disabled) a `Button`
 *    evitando duplicación de SVGs o layouts rotos.
 * 4. Combina respetuosamente la prop `disabled` con el estado de envío.
 */
export function ActionButton({
  children,
  onClick,
  secondary = false,
  danger = false,
  variant,
  size = 'default',
  className = '',
  type = 'button',
  disabled = false,
  isSubmitting: isSubmittingProp,
  ...props
}: ActionButtonProps) {
  const [internalSubmitting, setInternalSubmitting] = useState(false)
  const isSubmitting = isSubmittingProp ?? internalSubmitting
  const isDisabled = disabled || isSubmitting

  const resolvedVariant =
    variant ?? (danger ? 'destructive' : secondary ? 'secondary' : 'default')

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) return

    if (isSubmittingProp === undefined) {
      setInternalSubmitting(true)
      try {
        const result = onClick?.(e)
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          await result
        }
      } finally {
        setInternalSubmitting(false)
      }
    } else {
      onClick?.(e)
    }
  }

  return (
    <Button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      isLoading={isSubmitting}
      variant={resolvedVariant}
      size={size}
      className={cn(
        'action-button',
        secondary && 'action-secondary',
        danger && 'action-danger',
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
