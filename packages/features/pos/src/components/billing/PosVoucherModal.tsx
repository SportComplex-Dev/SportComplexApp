'use client'

import { Badge, Button } from '@sportcomplex/ui'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { formatDate, formatMoney, type Booking } from '@sportcomplex/core'
import type { TicketComprobanteInput } from '@sportcomplex/printing'
import type { ThermalPrinter } from '../../hooks/useThermalPrinter'
import { PosTicketPreview } from './PosTicketPreview'
import { PosTicketPrintActions } from './PosTicketPrintActions'

export interface PosVoucherModalProps {
  booking: Booking
  sellerName?: string
  /** Comprobante del servidor (`GET /api/pdf/receipt?destinatario=POS`); sin `qr` mientras no hay pase. */
  comprobante: TicketComprobanteInput | null
  printer: ThermalPrinter
  onNextSale: () => void
}

export function PosVoucherModal({
  booking,
  sellerName = 'Vendedor Taquilla',
  comprobante,
  printer,
  onNextSale,
}: PosVoucherModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-voucher-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-0 duration-200"
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="text-center mb-4">
          <div className="size-12 rounded-full bg-[#edf5e2] text-[#4b7652] mx-auto flex items-center justify-center mb-2">
            <CheckCircle2 size={28} />
          </div>
          <h2 id="pos-voucher-title" className="text-lg font-bold text-[var(--ink)]">
            {booking.status === 'Confirmada' ? '¡Venta Exitosa en Mostrador!' : 'Venta en Proceso en Mostrador'}
          </h2>
          <Badge variant={booking.status === 'Confirmada' ? 'success' : 'warning'} className="text-xs mt-1">
            {booking.status === 'Confirmada' ? 'Reserva CONFIRMADA · Canal TAQUILLA' : 'Reserva PENDIENTE DE PAGO · Canal TAQUILLA'}
          </Badge>
        </div>

        <div className="space-y-1 text-[11px] text-[var(--ink)] my-4">
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Código:</span>
            <strong>{booking.code}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Titular:</span>
            <span>{booking.client}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Servicio:</span>
            <span>{booking.service}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Fecha & Franja:</span>
            <span>
              {formatDate(booking.date)} · {booking.time}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Atendido por:</span>
            <span>{sellerName}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[var(--line)] font-bold">
            <span>TOTAL {booking.paymentStatus === 'Aprobada' ? 'PAGADO' : 'A COBRAR'}:</span>
            <span>{formatMoney(booking.amount)} COP</span>
          </div>
        </div>

        {/* Ticket térmico 1:1: el mismo bitmap que sale por la impresora */}
        {comprobante?.qr ? (
          <div className="my-4 rounded-xl bg-[var(--surface-soft)] p-3">
            <PosTicketPreview comprobante={comprobante} />
          </div>
        ) : (
          <div className="text-center my-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              Esperando confirmación de pago y emisión de pase...
            </p>
            <p className="text-[10px] text-[var(--subtle)] mt-1">
              El código QR firmado por el servidor se emitirá una vez confirmada la transacción en Stripe.
            </p>
          </div>
        )}

        {/* Acciones del Comprobante */}
        <div className="flex flex-col gap-2">
          {comprobante?.qr && <PosTicketPrintActions comprobante={comprobante} printer={printer} />}

          <Button
            id="btn-next-sale"
            variant="outline"
            size="default"
            onClick={onNextSale}
            className="w-full text-xs font-semibold gap-2"
            type="button"
          >
            <RotateCcw size={15} /> Nueva Venta (Siguiente Cliente)
          </Button>
        </div>
      </div>
    </div>
  )
}
