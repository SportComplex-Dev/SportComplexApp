'use client'

import {
  CheckCircle2, CircleAlert, ShieldCheck, X,
} from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

export function ToastMessage({ message, close, kind }: { message: string; close: () => void; kind: ToastKind }) {
  if (!message) return null
  const Icon = kind === 'error' ? CircleAlert : kind === 'success' ? CheckCircle2 : ShieldCheck
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      className={`toast-message ${kind === 'error' ? 'toast-error' : ''}`}
    >
      <Icon size={18} />
      <span>{message}</span>
      <button type="button" aria-label="Cerrar notificación" onClick={close}>
        <X size={15} />
      </button>
    </div>
  )
}
