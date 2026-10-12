'use client'

import React from 'react'
import { Badge, Button } from '@sportcomplex/ui'
import { CheckCircle2, Printer, RotateCcw } from 'lucide-react'
import { formatDate, formatMoney, type Booking } from '@sportcomplex/core'

interface PosVoucherModalProps {
  booking: Booking
  sellerName?: string
  receiptQrUrl: string | null
  onPrint: () => void
  onNextSale: () => void
}

export function PosVoucherModal({
  booking,
  sellerName = 'Vendedor Taquilla',
  receiptQrUrl,
  onPrint,
  onNextSale,
}: PosVoucherModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-voucher-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="text-center mb-4">
          <div className="size-12 rounded-full bg-[#edf5e2] text-[#4b7652] mx-auto flex items-center justify-center mb-2">
            <CheckCircle2 size={28} />
          </div>
          <h2 id="pos-voucher-title" className="text-lg font-bold text-[var(--ink)]">
            ¡Venta Exitosa en Mostrador!
          </h2>
          <Badge variant="success" className="text-xs mt-1">
            Reserva CONFIRMADA · Canal TAQUILLA
          </Badge>
        </div>

        {/* Comprobante en formato compacto listo para imprimir */}
        <div
          id="pos-print-voucher"
          className="border-2 border-dashed border-[var(--line)] p-4 rounded-xl bg-[var(--surface-soft)] text-xs text-[var(--ink)] my-4"
        >
          <div className="text-center pb-2 border-b border-[var(--line)] mb-3">
            <h3 className="font-extrabold text-sm tracking-wider">AKROS SPORTCOMPLEX</h3>
            <p className="text-[10px] text-[var(--subtle)]">
              Taquilla Presencial 100% Cashless · NIT 901.458.789-2
            </p>
            <p className="text-[11px] font-bold mt-1 text-[#123e30] dark:text-[#c9ef75]">
              COMPROBANTE DE VENTA & PASE DIGITAL
            </p>
          </div>

          <div className="space-y-1 text-[11px]">
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
              <span className="text-[var(--subtle)]">Sede:</span>
              <span>{booking.sede}</span>
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
            <div className="flex justify-between">
              <span className="text-[var(--subtle)]">Pasarela:</span>
              <span>Stripe Cashless ({booking.transactionRef?.slice(0, 16)})</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-[var(--line)] font-bold">
              <span>TOTAL PAGADO:</span>
              <span>{formatMoney(booking.amount)} COP</span>
            </div>
          </div>

          {/* QR de acceso centrado para torniquete óptico */}
          {receiptQrUrl && (
            <div className="text-center my-4 pt-3 border-t border-[var(--line)]">
              <p className="text-[10px] font-bold text-[var(--subtle)] uppercase tracking-wider mb-2">
                Código QR de Acceso en Puerta
              </p>
              <img
                src={receiptQrUrl}
                alt={`QR de acceso ${booking.code}`}
                className="size-36 mx-auto rounded-lg border border-[var(--line)] p-1 bg-white"
              />
              <p className="text-[9px] text-[var(--subtle)] mt-1">
                Firma HMAC verificada para torniquetes (RF-13)
              </p>
            </div>
          )}
        </div>

        {/* Acciones del Comprobante */}
        <div className="flex flex-col gap-2">
          <Button
            id="btn-print-receipt"
            variant="brand"
            size="default"
            onClick={onPrint}
            className="w-full text-xs font-semibold gap-2"
            type="button"
          >
            <Printer size={15} /> Imprimir Comprobante (PDF 58mm / Estándar)
          </Button>

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
