'use client'

import { Button, Input } from '@sportcomplex/ui'
import { Smartphone, X, Copy, Check } from 'lucide-react'

export interface PosAltLinkModalProps {
  isOpen: boolean
  onClose: () => void
  altLinkUrl: string
  altLinkQrUrl: string | null
  copiedLink: boolean
  onCopyLink: () => void
}

export function PosAltLinkModal({
  isOpen,
  onClose,
  altLinkUrl,
  altLinkQrUrl,
  copiedLink,
  onCopyLink,
}: PosAltLinkModalProps) {
  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-alt-link-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <h3 id="pos-alt-link-title" className="font-bold text-sm flex items-center gap-2">
            <Smartphone size={16} className="text-[#123e30] dark:text-[#c9ef75]" /> Enlace de Pago Alternativo
          </h3>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            className="text-[var(--subtle)] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[var(--subtle)] mb-4">
          Si la tarjeta del cliente no puede ser digitada en mostrador o exige autenticación 3DS en su app bancaria, entrega este enlace o solicita que escanee el código QR desde su celular (SRS §11.1).
        </p>

        {altLinkQrUrl && (
          <div className="p-4 bg-[var(--surface-soft)] rounded-xl border border-[var(--line)] flex flex-col items-center mb-4">
            <img
              src={altLinkQrUrl}
              alt="QR para pago móvil alternativo"
              className="size-48 rounded-lg bg-white p-2 border border-[var(--line)]"
            />
            <span className="text-[11px] font-semibold text-[var(--ink)] mt-2">
              Escanear con la cámara del celular
            </span>
            <span className="text-[10px] text-[var(--subtle)]">
              Abre directamente la pasarela /checkout con la reserva lista
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Input
            id="pos-alt-link-input"
            readOnly
            value={altLinkUrl}
            className="text-xs font-mono select-all"
            aria-label="URL del enlace alternativo"
          />
          <Button
            id="btn-copy-alt-link"
            variant="outline"
            size="default"
            onClick={onCopyLink}
            className="shrink-0 text-xs gap-1.5"
            type="button"
          >
            {copiedLink ? <Check size={14} className="text-[#5e8b48]" /> : <Copy size={14} />}
            {copiedLink ? 'Copiado' : 'Copiar'}
          </Button>
        </div>

        <div className="mt-4 pt-3 border-t border-[var(--line)] flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs"
            type="button"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
