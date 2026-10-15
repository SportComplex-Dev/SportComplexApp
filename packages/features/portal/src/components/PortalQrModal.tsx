'use client'

import { Printer, ShieldCheck, X } from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { formatDate, type Booking } from '@sportcomplex/core'
import { QRGraphicHD } from './QrModal'
import { AccessWindowIndicator } from './AccessWindowIndicator'
import type { PortalTicket } from '../utils/portal-utils'

export interface PortalQrModalProps {
  ticket: PortalTicket | null
  onClose: () => void
  onPrint: (ticket: Booking) => void
  open?: boolean
  isOpen?: boolean
}

export function PortalQrModal({
  ticket,
  onClose,
  onPrint,
  open = true,
  isOpen = true,
}: PortalQrModalProps) {
  const shouldReduceMotion = useReducedMotion()
  if (!open || !isOpen || !ticket) return null

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
        aria-labelledby="qr-modal-title"
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
          <h2 id="qr-modal-title" className="text-xl font-bold tracking-tight mt-1 mb-1">
            {ticket.service}
          </h2>
          <p className="text-xs text-[var(--subtle)]">
            Sede {ticket.sede} · {formatDate(ticket.date)}, {ticket.time}
          </p>

          <QRGraphicHD code={ticket.code} />

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
            <span>Pase transferible sin biometría. Acerca la pantalla al lector óptico del torniquete.</span>
          </div>

          <div className="qr-modal-actions">
            <button
              type="button"
              className="action-button text-xs py-2 px-4 gap-2"
              onClick={() => onPrint(ticket)}
            >
              <Printer size={15} /> Imprimir / PDF
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
