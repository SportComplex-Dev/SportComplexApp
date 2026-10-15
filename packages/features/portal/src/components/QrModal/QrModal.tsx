'use client'

import { useEffect, useState } from 'react'
import { Download, Printer, QrCode, ShieldCheck, X } from 'lucide-react'
import { formatDate, type Booking } from '@sportcomplex/core'
import { fetchReceiptData, generarQRDataUrl, sanitizeFilename } from '../../utils/portal-utils'

export interface QrModalProps {
  ticket: Booking | null
  onClose: () => void
  onPrint?: (ticket: Booking) => void
  open?: boolean
  isOpen?: boolean
}

/**
 * Gráfico QR estándar de alta definición renderizado desde data URL PNG (RF-10 / RF-13).
 * Decodificable directamente por torniquetes ópticos perimetrales y lectores de mano.
 */
export function QRGraphicHD({
  code,
  dataUrl: initialDataUrl,
}: {
  code: string
  dataUrl?: string | null | undefined
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(initialDataUrl ?? null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (initialDataUrl) {
      setDataUrl(initialDataUrl)
      return
    }
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
  }, [code, initialDataUrl])

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
export function QrModal({
  ticket,
  onClose,
  onPrint,
  open = true,
  isOpen = true,
}: QrModalProps) {
  const [currentTicket, setCurrentTicket] = useState<Booking | null>(ticket)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    setCurrentTicket(ticket)
    if (!ticket) return undefined

    // Si el ticket no posee payload firmado y tiene ID, obtener comprobante oficial (SEC-01 / NEW-02)
    if (!ticket.qrPayload && ticket.id) {
      let isCurrent = true
      fetchReceiptData(ticket.id)
        .then((receipt) => {
          const qr = receipt?.qr
          if (isCurrent && qr?.payload) {
            setCurrentTicket((prev) =>
              prev && prev.id === ticket.id
                ? { ...prev, qrPayload: qr.payload, qrDataUrl: qr.dataUrl }
                : prev
            )
          }
        })
        .catch(() => {})
      return () => {
        isCurrent = false
      }
    }
    return undefined
  }, [ticket])

  if (!open || !isOpen || !currentTicket) return null

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      let dataUrl = currentTicket.qrDataUrl
      let qrPayload = currentTicket.qrPayload

      if (!dataUrl) {
        if (!qrPayload && currentTicket.id) {
          const receipt = await fetchReceiptData(currentTicket.id).catch(() => null)
          if (receipt?.qr?.dataUrl) {
            dataUrl = receipt.qr.dataUrl
          } else if (receipt?.qr?.payload) {
            qrPayload = receipt.qr.payload
          }
        }
        if (!dataUrl) {
          const qrTarget = qrPayload || currentTicket.code
          dataUrl = await generarQRDataUrl(qrTarget, 600)
        }
      }

      const safeFilename = `ticket-${sanitizeFilename(currentTicket.code)}.png`
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = safeFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Error al descargar código QR:', err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="qr-modal-overlay animate-in fade-in-0 duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
    >
      <div className="qr-modal-dialog animate-in fade-in-0 zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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

        {/* Componente de código QR estándar real con payload firmado */}
        <QRGraphicHD
          code={currentTicket.qrPayload || currentTicket.code}
          dataUrl={currentTicket.qrDataUrl}
        />

        <div className="qr-modal-code-tag">{currentTicket.code}</div>

        <div className="qr-modal-meta">
          <div className="qr-meta-item">
            <span>Servicio</span>
            <strong>{currentTicket.service}</strong>
          </div>
          <div className="qr-meta-item">
            <span>Fecha y Hora</span>
            <strong>
              {formatDate(currentTicket.date)} · {currentTicket.time}
            </strong>
          </div>
          <div className="qr-meta-item">
            <span>Sede</span>
            <strong>Sede {currentTicket.sede} · Medellín</strong>
          </div>
          <div className="qr-meta-item">
            <span>Cupos</span>
            <strong>
              {currentTicket.attendees} {currentTicket.attendees === 1 ? 'persona' : 'personas'}
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
            disabled={downloading}
            onClick={handleDownload}
          >
            <Download size={16} /> Descargar Imagen
          </button>
          {onPrint && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onPrint(currentTicket)}
            >
              <Printer size={16} /> Imprimir Voucher
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
