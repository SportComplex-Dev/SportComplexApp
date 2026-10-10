'use client'

import { useEffect, useState } from 'react'
import { formatDate, type Booking } from '@sportcomplex/core'
import { calcularDesgloseComprobante, generarQRDataUrl } from './portal-utils'

interface PrintableReceiptProps {
  ticket: Booking | null
  qrDataUrl?: string | null
}

/**
 * Comprobante digital / voucher en formato de impresión con QR legible en torniquete (RN-14 / RNF-05).
 */
export function PrintableReceipt({ ticket, qrDataUrl: initialQrUrl }: PrintableReceiptProps) {
  const [generatedQr, setGeneratedQr] = useState<string | null>(initialQrUrl ?? null)

  useEffect(() => {
    if (initialQrUrl) {
      setGeneratedQr(initialQrUrl)
      return
    }
    if (!ticket) {
      setGeneratedQr(null)
      return
    }
    let isCurrent = true
    generarQRDataUrl(ticket.code, 260)
      .then((url) => {
        if (isCurrent) setGeneratedQr(url)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [ticket, initialQrUrl])

  if (!ticket) return null

  const { subtotalFormateado, ivaFormateado, totalFormateado } = calcularDesgloseComprobante(ticket.amount)

  return (
    <div className="printable-receipt">
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>AKROS SPORTCOMPLEX</h2>
        <p style={{ margin: 0, fontSize: '13px' }}>Complejo Deportivo y Wellness Cashless</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>NIT: 901.458.789-2 · Medellín, Colombia</p>
        <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 'bold' }}>COMPROBANTE DE RESERVA Y PASE DIGITAL</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '13px' }}>
        <div>
          <p style={{ margin: '4px 0' }}><strong>Código de Pase:</strong> {ticket.code}</p>
          <p style={{ margin: '4px 0' }}><strong>Titular:</strong> {ticket.client}</p>
          <p style={{ margin: '4px 0' }}><strong>Servicio:</strong> {ticket.service}</p>
          <p style={{ margin: '4px 0' }}><strong>Sede:</strong> Sede {ticket.sede} · Medellín</p>
        </div>
        <div>
          <p style={{ margin: '4px 0' }}><strong>Fecha del Servicio:</strong> {formatDate(ticket.date)}</p>
          <p style={{ margin: '4px 0' }}><strong>Horario:</strong> {ticket.time}</p>
          <p style={{ margin: '4px 0' }}><strong>Capacidad / Cupos:</strong> {ticket.attendees} {ticket.attendees === 1 ? 'persona' : 'personas'}</p>
          <p style={{ margin: '4px 0' }}><strong>Estado:</strong> {ticket.status.toUpperCase()}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
            <th style={{ padding: '8px 4px' }}>Descripción</th>
            <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total (COP)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '8px 4px' }}>Reserva deportiva: {ticket.service}</td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{subtotalFormateado}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px 4px' }}>IVA (19%)</td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{ivaFormateado}</td>
          </tr>
          <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '15px' }}>
            <td style={{ padding: '10px 4px' }}>TOTAL PAGADO</td>
            <td style={{ padding: '10px 4px', textAlign: 'right' }}>{totalFormateado} COP</td>
          </tr>
        </tbody>
      </table>

      {/* Código QR impreso para validación en torniquetes ópticos (RN-14) */}
      <div style={{ textAlign: 'center', marginTop: '24px', padding: '12px 0' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          PRESENTA ESTE CÓDIGO EN EL TORNIQUETE O LECTOR ÓPTICO
        </p>
        {generatedQr && (
          <div style={{ margin: '0 auto', display: 'inline-block', padding: '8px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' }}>
            <img
              src={generatedQr}
              alt={`QR Acceso ${ticket.code}`}
              style={{ width: '160px', height: '160px', display: 'block' }}
            />
          </div>
        )}
        <p style={{ fontSize: '11px', color: '#666', margin: '8px 0 4px' }}>Código UUID: {ticket.code}</p>
        <p style={{ fontSize: '10px', color: '#888', marginTop: '12px' }}>
          * Cancelaciones y reprogramaciones gratuitas hasta 4 horas antes del horario de reserva. Pase transferible (RF-10 / RF-12).
        </p>
      </div>
    </div>
  )
}
