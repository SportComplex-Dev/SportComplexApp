'use client'

import { Download, ShieldCheck, Printer, X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { formatDate } from '@sportcomplex/core'
import { QRGraphicHD } from '../QrGraphic'
import { AccessWindowIndicator } from '../AccessWindowIndicator'
import type { PortalTicket } from '../../utils/portal-utils'

export interface TicketQrModalProps {
  ticket: PortalTicket | null
  onClose: () => void
  onPrintTicket: (ticket: PortalTicket) => void
  onDownloadQr?: (ticket: PortalTicket) => void
  downloading?: boolean
  printing?: boolean
}

/**
 * Único modal de pase digital (consolida PortalQrModal + antiguo QrModal).
 * La acción de descarga es opcional: el dashboard la omite (solo impresión),
 * la vista de tickets la incluye.
 */
export function TicketQrModal({
  ticket,
  onClose,
  onPrintTicket,
  onDownloadQr,
  downloading = false,
  printing = false,
}: TicketQrModalProps) {
  const shouldReduceMotion = useReducedMotion()
  if (!ticket) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="qr-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ticket-qr-modal-title"
        onClick={onClose}
      >
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 14 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="qr-modal-dialog"
          onClick={(e) => e.stopPropagation()}
        >
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
            {ticket.service}
          </h2>
          <p className="text-xs text-[var(--subtle)]">
            Sede {ticket.sede} · {formatDate(ticket.date)}, {ticket.time}
          </p>

          <QRGraphicHD
            code={ticket.qrPayload || ticket.code}
            dataUrl={ticket.qrDataUrl}
          />

          <AccessWindowIndicator
            date={ticket.date}
            time={ticket.time}
            accessWindowStart={ticket.accessWindowStart}
            accessWindowEnd={ticket.accessWindowEnd}
          />

          <div className="mt-2 mb-3">
            <b className="text-lg font-mono tracking-widest block text-[var(--ink)]">
              {ticket.code}
            </b>
            <span className="text-xs text-[var(--subtle)] mt-0.5 block">
              Titular: <strong>{ticket.client}</strong> · {ticket.attendees}{' '}
              {ticket.attendees === 1 ? 'cupo' : 'cupos'}
            </span>
          </div>

          <div className="qr-turnstile-hint">
            <ShieldCheck size={16} className="text-[var(--brand-accent)] shrink-0" />
            <span>Pase transferible sin biometría (RF-10 / RF-12). Acerca la pantalla o la imagen al lector óptico.</span>
          </div>

          <div className="qr-modal-actions flex-wrap gap-2">
            {onDownloadQr && (
              <button
                type="button"
                className="action-button text-xs py-2 px-4 gap-2"
                disabled={downloading}
                onClick={() => onDownloadQr(ticket)}
              >
                <Download size={15} /> Descargar Imagen QR (PNG)
              </button>
            )}
            <button
              type="button"
              className="calendar-shortcut text-xs py-2 px-4 gap-2"
              disabled={printing}
              onClick={() => onPrintTicket(ticket)}
            >
              <Printer size={15} /> {onDownloadQr ? 'Imprimir Recibo (58mm)' : 'Imprimir / PDF'}
            </button>
            <button
              type="button"
              className="calendar-shortcut text-xs py-2 px-4"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
