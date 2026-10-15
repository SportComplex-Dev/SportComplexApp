'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ActionButton } from '../formularios/ActionButton'

export interface ModalProps {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}

export function Modal({
  title,
  description,
  onClose,
  children,
  maxWidth = '460px',
}: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-6 relative animate-in fade-in-0 zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        style={{ maxWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">{description}</p>
        )}
        {children}
      </div>
    </div>
  )
}

export interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} description={message} onClose={onCancel}>
      <div className="form-actions">
        <ActionButton secondary onClick={onCancel}>
          Cancelar
        </ActionButton>
        <ActionButton danger onClick={onConfirm}>
          {confirmLabel}
        </ActionButton>
      </div>
    </Modal>
  )
}
