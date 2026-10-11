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
    <div className="printable-receipt font-mono text-[11px] leading-tight text-black bg-white max-w-[58mm] mx-auto p-2">
      <div className="text-center border-b border-black pb-2 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider m-0">AKROS SPORTCOMPLEX</h2>
        <p className="text-[9px] m-0">Complejo Deportivo & Wellness Cashless</p>
        <p className="text-[9px] m-0 text-gray-700">NIT: 901.458.789-2 · Medellín</p>
        <div className="text-[10px] font-bold mt-1.5 pt-1 border-t border-dashed border-black">
          COMPROBANTE 58mm · PASE DIGITAL
        </div>
      </div>

      <div className="space-y-1 mb-2 border-b border-dashed border-black pb-2 text-[10px]">
        <div><span className="font-bold">BOLETO:</span> {ticket.code}</div>
        <div><span className="font-bold">TITULAR:</span> {ticket.client}</div>
        <div><span className="font-bold">SERVICIO:</span> {ticket.service}</div>
        <div><span className="font-bold">FECHA:</span> {formatDate(ticket.date)}</div>
        <div><span className="font-bold">HORARIO:</span> {ticket.time}</div>
        <div><span className="font-bold">SEDE:</span> Sede {ticket.sede}</div>
        <div><span className="font-bold">CUPOS:</span> {ticket.attendees} {ticket.attendees === 1 ? 'persona' : 'personas'}</div>
        <div><span className="font-bold">ESTADO:</span> {ticket.status.toUpperCase()}</div>
      </div>

      <div className="mb-2 border-b border-black pb-2 text-[10px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{subtotalFormateado}</span>
        </div>
        <div className="flex justify-between">
          <span>IVA (19%):</span>
          <span>{ivaFormateado}</span>
        </div>
        <div className="flex justify-between font-bold text-[11px] pt-1 mt-1 border-t border-dotted border-black">
          <span>TOTAL:</span>
          <span>{totalFormateado} COP</span>
        </div>
      </div>

      {/* Código QR impreso para torniquete óptico (RF-10 / RN-14 / RNF-05) */}
      <div className="text-center my-2">
        {generatedQr && (
          <div className="inline-block p-1 bg-white border border-black mx-auto">
            <img
              src={generatedQr}
              alt={`QR Acceso ${ticket.code}`}
              className="w-32 h-32 mx-auto block object-contain"
            />
          </div>
        )}
        <p className="text-[9px] font-bold mt-1.5 mb-0.5">VALIDACIÓN ÓPTICA EN TORNIQUETE</p>
        <p className="text-[8px] text-gray-600 m-0 leading-normal">
          Pase digital transferible sin biometría (RF-10 / RF-12). Válido para ingreso por torniquete de sede.
        </p>
      </div>
    </div>
  )
}
