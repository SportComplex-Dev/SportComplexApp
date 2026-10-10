'use client'

import { useEffect, useState } from 'react'
import { Download, Printer, QrCode, ShieldCheck, X } from 'lucide-react'
import { formatDate, type Booking } from '@sportcomplex/core'
import { generarQRDataUrl } from './portal-utils'

interface QrModalProps {
  ticket: Booking | null
  onClose: () => void
  onPrint?: (ticket: Booking) => void
}

/**
 * Gráfico QR estándar de alta definición renderizado desde data URL PNG (RF-10 / RF-13).
 * Decodificable directamente por torniquetes ópticos perimetrales y lectores de mano.
 */
export function QRGraphicHD({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isCurrent = true
    generarQRDataUrl(code, 300)
      .then((url) => {
        if (isCurrent) setDataUrl(url)
      })
      .catch(() => {
        if (isCurrent) setError(true)
      })
    return () => {
      isCurrent = false
    }
  }, [code])

  return (
    <div className="qr-modal-hd" aria-label={`Código QR de acceso para ticket ${code}`}>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`Código QR de acceso ${code}`}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : error ? (
        <div style={{ color: 'var(--subtle)', fontSize: '13px' }}>Error al generar QR</div>
      ) : (
        <div style={{ color: 'var(--subtle)', fontSize: '12px' }}>Generando QR...</div>
      )}
    </div>
  )
}

/**
 * Modal interactivo de visualización de pase digital y código QR HD.
 */
export function QrModal({ ticket, onClose, onPrint }: QrModalProps) {
  if (!ticket) return null

  const handleDownload = async () => {
    try {
      const url = await generarQRDataUrl(ticket.code, 600)
      const link = document.createElement('a')
      link.href = url
      link.download = `ticket-${ticket.code}.png`
      link.click()
    } catch {
      // Fallback silencioso
    }
  }

  return (
    <div
      className="qr-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
    >
      <div className="qr-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <button
          className="qr-modal-close"
          onClick={onClose}
          aria-label="Cerrar modal de código QR"
        >
          <X size={20} />
        </button>

        <div className="qr-modal-icon-badge">
          <QrCode size={26} />
        </div>

        <h3 id="qr-modal-title">Pase Digital de Acceso</h3>
        <p className="qr-modal-subtitle">
          Presenta este código en los torniquetes ópticos perimetrales de la sede.
        </p>

        {/* Componente de código QR estándar real */}
        <QRGraphicHD code={ticket.code} />

        <div className="qr-modal-code-tag">{ticket.code}</div>

        <div className="qr-modal-meta">
          <div className="qr-meta-item">
            <span>Servicio</span>
            <strong>{ticket.service}</strong>
          </div>
          <div className="qr-meta-item">
            <span>Fecha y Hora</span>
            <strong>
              {formatDate(ticket.date)} · {ticket.time}
            </strong>
          </div>
          <div className="qr-meta-item">
            <span>Sede</span>
            <strong>Sede {ticket.sede} · Medellín</strong>
          </div>
          <div className="qr-meta-item">
            <span>Cupos</span>
            <strong>
              {ticket.attendees} {ticket.attendees === 1 ? 'persona' : 'personas'}
            </strong>
          </div>
        </div>

        <div className="qr-turnstile-hint">
          <ShieldCheck size={16} /> Lectura óptica de alta velocidad · Válido para 1 acceso
        </div>

        <div className="qr-modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownload}
          >
            <Download size={16} /> Descargar Imagen
          </button>
          {onPrint && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onPrint(ticket)}
            >
              <Printer size={16} /> Imprimir Voucher
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
