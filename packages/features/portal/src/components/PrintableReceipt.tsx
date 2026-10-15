'use client'

import { useEffect, useState } from 'react'
import { formatDate, formatMoney, type Booking } from '@sportcomplex/core'
import { calcularDesgloseComprobante, generarQRDataUrl, type ReceiptApiResponse } from '../utils/portal-utils'

interface PrintableReceiptProps {
  ticket: Booking | null
  qrDataUrl?: string | null
  receiptData?: ReceiptApiResponse | null
}

/**
 * Comprobante digital / voucher en formato de impresión con QR legible en torniquete (RN-14 / RNF-05).
 */
export function PrintableReceipt({
  ticket,
  qrDataUrl: initialQrUrl,
  receiptData,
}: PrintableReceiptProps) {
  const [generatedQr, setGeneratedQr] = useState<string | null>(
    receiptData?.qr?.dataUrl ?? initialQrUrl ?? null
  )

  useEffect(() => {
    if (receiptData?.qr?.dataUrl) {
      setGeneratedQr(receiptData.qr.dataUrl)
      return
    }
    if (initialQrUrl) {
      setGeneratedQr(initialQrUrl)
      return
    }
    if (!ticket) {
      setGeneratedQr(null)
      return
    }
    let isCurrent = true
    const qrTarget = receiptData?.qr?.payload || ticket.qrPayload || ticket.code
    generarQRDataUrl(qrTarget, 260)
      .then((url) => {
        if (isCurrent) setGeneratedQr(url)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [ticket, initialQrUrl, receiptData])

  if (!ticket) return null

  const entidad = receiptData?.membrete?.entidad ?? 'AKROS SPORTCOMPLEX'
  const nit = receiptData?.membrete?.nit ?? 'NIT: 901.458.789-2 · Medellín'

  const { subtotalFormateado, ivaFormateado, totalFormateado } = calcularDesgloseComprobante(ticket.amount)

  // Priorizar cifras oficiales devueltas por TSK-BE-19 (ARC-01)
  const hasServerFiscal = Boolean(receiptData?.reserva?.subtotal && receiptData?.reserva?.total)
  const serverSubtotal = hasServerFiscal ? Number(receiptData!.reserva!.subtotal) : null
  const serverTotal = hasServerFiscal ? Number(receiptData!.reserva!.total) : null
  const serverIva = (serverSubtotal !== null && serverTotal !== null)
    ? Math.max(0, Math.round(serverTotal - serverSubtotal))
    : null
  const descuentoPct = receiptData?.reserva?.descuentoPct ? Number(receiptData.reserva.descuentoPct) : 0

  const subtotalText = serverSubtotal !== null ? formatMoney(Math.round(serverSubtotal)) : subtotalFormateado
  const ivaText = serverIva !== null ? formatMoney(serverIva) : ivaFormateado
  const totalText = serverTotal !== null ? `${formatMoney(Math.round(serverTotal))} COP` : `${totalFormateado} COP`

  return (
    <div className="printable-receipt font-mono text-[11px] leading-tight text-black bg-white max-w-[58mm] mx-auto p-2">
      <div className="text-center border-b border-black pb-2 mb-2">
        <h2 className="text-xs font-bold uppercase tracking-wider m-0 text-black">{entidad}</h2>
        <p className="text-[9px] m-0 text-black">Complejo Deportivo & Wellness Cashless</p>
        <p className="text-[9px] m-0 text-black">{nit}</p>
        <div className="text-[10px] font-bold mt-1.5 pt-1 border-t border-dashed border-black text-black">
          COMPROBANTE 58mm · PASE DIGITAL
        </div>
      </div>

      <div className="space-y-1 mb-2 border-b border-dashed border-black pb-2 text-[10px] text-black">
        <div><span className="font-bold">BOLETO:</span> {ticket.code}</div>
        <div><span className="font-bold">TITULAR:</span> {ticket.client}</div>
        <div><span className="font-bold">SERVICIO:</span> {ticket.service}</div>
        <div><span className="font-bold">FECHA:</span> {formatDate(ticket.date)}</div>
        <div><span className="font-bold">HORARIO:</span> {ticket.time}</div>
        <div><span className="font-bold">SEDE:</span> Sede {ticket.sede}</div>
        <div><span className="font-bold">CUPOS:</span> {ticket.attendees} {ticket.attendees === 1 ? 'persona' : 'personas'}</div>
        <div><span className="font-bold">ESTADO:</span> {ticket.status.toUpperCase()}</div>
      </div>

      <div className="mb-2 border-b border-black pb-2 text-[10px] text-black">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{subtotalText}</span>
        </div>
        {descuentoPct > 0 && (
          <div className="flex justify-between">
            <span>Descuento ({descuentoPct}%):</span>
            <span>Aplicado</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>IVA{hasServerFiscal ? '' : ' (19%)'}:</span>
          <span>{ivaText}</span>
        </div>
        <div className="flex justify-between font-bold text-[11px] pt-1 mt-1 border-t border-dotted border-black">
          <span>TOTAL:</span>
          <span>{totalText}</span>
        </div>
      </div>

      {/* Código QR impreso para torniquete óptico (RF-10 / RN-14 / RNF-05) */}
      <div className="text-center my-2 text-black">
        {generatedQr && (
          <div className="inline-block p-1 bg-white border border-black mx-auto">
            <img
              src={generatedQr}
              alt={`QR Acceso ${ticket.code}`}
              className="w-32 h-32 mx-auto block object-contain"
            />
          </div>
        )}
        <p className="text-[9px] font-bold mt-1.5 mb-0.5 text-black">VALIDACIÓN ÓPTICA EN TORNIQUETE</p>
        <p className="text-[8px] text-black m-0 leading-normal">
          Pase digital transferible sin biometría (RF-10 / RF-12). Válido para ingreso por torniquete de sede.
        </p>
      </div>
    </div>
  )
}
