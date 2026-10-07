import React from 'react'
import { Button, cn, type ButtonProps } from '@sportcomplex/ui'

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  secondary?: boolean
  danger?: boolean
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
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
  disabled = false,
  ...props
}: ActionButtonProps) {
  const resolvedVariant = variant ?? (danger ? 'destructive' : secondary ? 'secondary' : 'default')
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      variant={resolvedVariant}
      size={size}
      className={cn('action-button', secondary && 'action-secondary', danger && 'action-danger', className)}
      {...props}
    >
      {children}
    </Button>
  )
}
