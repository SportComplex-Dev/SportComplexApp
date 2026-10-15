'use client'

import { Download, ShieldCheck, Printer, X } from 'lucide-react'
import { formatDate } from '@sportcomplex/core'
import { QRGraphicHD } from './QrModal'
import { AccessWindowIndicator } from './AccessWindowIndicator'
import type { PortalTicket } from '../utils/portal-utils'

interface TicketQrModalProps {
  selectedTicket: PortalTicket | null
  downloadingId: string | null
  isPrinting: boolean
  onClose: () => void
  onDownloadQr: (ticket: PortalTicket) => void
  onPrintTicket: (ticket: PortalTicket) => void
}

export function TicketQrModal({
  selectedTicket,
  downloadingId,
  isPrinting,
  onClose,
  onDownloadQr,
  onPrintTicket,
}: TicketQrModalProps) {
  if (!selectedTicket) return null

  return (
    <div
      className="qr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-qr-modal-title"
      onClick={onClose}
    >
      <div className="qr-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="modal-close"
          aria-label="Cerrar modal de QR"
          onClick={onClose}
        >
          <X size={18} />
        </button>

        <span className="eyebrow justify-center text-xs">PASE DE ACCESO DIGITAL</span>
        <h2 id="ticket-qr-modal-title" className="text-xl font-bold tracking-tight mt-1 mb-1">
          {selectedTicket.service}
        </h2>
        <p className="text-xs text-[var(--subtle)]">
          Sede {selectedTicket.sede} · {formatDate(selectedTicket.date)}, {selectedTicket.time}
        </p>

        <QRGraphicHD
          code={selectedTicket.qrPayload || selectedTicket.code}
          dataUrl={selectedTicket.qrDataUrl}
        />

        <AccessWindowIndicator
          date={selectedTicket.date}
          time={selectedTicket.time}
          accessWindowStart={selectedTicket.accessWindowStart}
          accessWindowEnd={selectedTicket.accessWindowEnd}
        />

        <div className="mt-2 mb-3">
          <b className="text-lg font-mono tracking-widest block text-[var(--ink)]">
            {selectedTicket.code}
          </b>
          <span className="text-xs text-[var(--subtle)] mt-0.5 block">
            Titular: <strong>{selectedTicket.client}</strong> · {selectedTicket.attendees}{' '}
            {selectedTicket.attendees === 1 ? 'cupo' : 'cupos'}
          </span>
        </div>

        <div className="qr-turnstile-hint">
          <ShieldCheck size={16} className="text-[var(--brand-accent)] shrink-0" />
          <span>Pase transferible sin biometría (RF-10 / RF-12). Acerca la pantalla o la imagen al lector óptico.</span>
        </div>

        <div className="qr-modal-actions flex-wrap gap-2">
          <button
            type="button"
            className="action-button text-xs py-2 px-4 gap-2"
            disabled={downloadingId === selectedTicket.id}
            onClick={() => onDownloadQr(selectedTicket)}
          >
            <Download size={15} /> Descargar Imagen QR (PNG)
          </button>
          <button
            type="button"
            className="calendar-shortcut text-xs py-2 px-4 gap-2"
            disabled={isPrinting}
            onClick={() => onPrintTicket(selectedTicket)}
          >
            <Printer size={15} /> Imprimir Recibo (58mm)
          </button>
          <button
            type="button"
            className="calendar-shortcut text-xs py-2 px-4"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
