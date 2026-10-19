import React, { useState } from 'react'
import { Button, cn, type ButtonProps } from '@sportcomplex/ui'

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean
  danger?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  isSubmitting?: boolean
}

export function ActionButton({
  children,
  onClick,
  secondary = false,
  danger = false,
  variant,
  size = 'default',
  className = '',
  type = 'button',
  isSubmitting = false,
  ...props
}: ActionButtonProps) {
  const resolvedVariant = variant ?? (danger ? 'destructive' : secondary ? 'secondary' : 'default')
  const [isSubmittingState, setIsSubmittingState] = useState(isSubmitting)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (isSubmittingState) return
    setIsSubmittingState(true)
    onClick?.(e)
  }

  return (
    <Button
      type={type}
      onClick={handleClick}
      disabled={isSubmittingState}
      isLoading={isSubmittingState}
      variant={resolvedVariant}
      size={size}
      className={cn(
        'action-button',
        secondary && 'action-secondary',
        danger && 'action-danger',
        isSubmittingState && 'opacity-50',
        className
      )}
      {...props}
    >
      {isSubmittingState ? (
        <span className="inline-flex items-center gap-2">
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  )
}
