'use client'

import { Download } from 'lucide-react'
import { receiptPdfUrl } from '../../utils/portal-utils'

export interface ReceiptPdfLinkProps {
  reservaId: string
  className?: string
  label?: string
}

/**
 * Descarga del comprobante en PDF de 58 mm (`GET /api/pdf/receipt/file`).
 * Es la única salida en papel del cliente: imprimir en la térmica es
 * exclusivo del operador en taquilla.
 */
export function ReceiptPdfLink({
  reservaId,
  className = 'calendar-shortcut text-xs py-2 px-3 gap-1.5',
  label = 'Descargar PDF',
}: ReceiptPdfLinkProps) {
  return (
    <a href={receiptPdfUrl(reservaId)} download className={className} title="Descargar comprobante en PDF (58 mm)">
      <Download size={14} /> {label}
    </a>
  )
}
