'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ActionButton } from '@/components/action-button'

export function Modal({
  title,
  description,
  onClose,
  children,
  maxWidth = '460px',
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="form-modal"
        style={{ maxWidth }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="modal-close"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {description && <p className="form-modal-desc">{description}</p>}
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
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
