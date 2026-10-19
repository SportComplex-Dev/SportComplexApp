'use client'

import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@sportcomplex/ui'
import { Smartphone, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { formatMoney, type CatalogItem } from '@sportcomplex/core'

export interface PosPaymentStripeProps {
  currentService?: CatalogItem
  subtotalBruto: number
  descuentoMonto: number
  subtotalNeto: number
  ivaMonto: number
  totalFinal: number
  isMember: boolean
  isProcessing: boolean
  processStep: string
  /** Claves de prueba de Stripe: no se realizan cobros reales. */
  isTestMode: boolean
  onGenerateAltLink: () => void
}

export function PosPaymentStripe({
  currentService,
  subtotalBruto,
  descuentoMonto,
  subtotalNeto,
  ivaMonto,
  totalFinal,
  isMember,
  isProcessing,
  processStep,
  isTestMode,
  onGenerateAltLink,
}: PosPaymentStripeProps) {
  return (
    <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
      <CardHeader className="pb-3 border-b border-[var(--line)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-[#123e30] text-[#c9ef75] text-xs font-bold">3</span>
            Cobro Stripe (Cashless)
          </CardTitle>
          <Badge variant="success" className="text-xs">Cero Efectivo</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-4">
        {/* Desglose Contable */}
        <div className="p-3 bg-[var(--surface-soft)] rounded-lg text-xs flex flex-col gap-1.5 border border-[var(--line)]">
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Servicio:</span>
            <strong className="text-right truncate max-w-44">{currentService?.name}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--subtle)]">Tarifa regular:</span>
            <span>{formatMoney(subtotalBruto)}</span>
          </div>
          {isMember && (
            <div className="flex justify-between text-[#5e8b48] font-medium">
              <span>Descuento Socio (30%):</span>
              <span>-{formatMoney(descuentoMonto)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] text-[var(--subtle)]">
            <span>Base gravable:</span>
            <span>{formatMoney(subtotalNeto)}</span>
          </div>
          <div className="flex justify-between text-[11px] text-[var(--subtle)]">
            <span>IVA (19%):</span>
            <span>{formatMoney(ivaMonto)}</span>
          </div>
          <div className="pt-2 border-t border-[var(--line)] flex justify-between items-baseline font-bold text-sm">
            <span>TOTAL A COBRAR:</span>
            <span className="text-base text-[#123e30] dark:text-[#c9ef75]">{formatMoney(totalFinal)} COP</span>
          </div>
        </div>

        {/* Panel de Cobro Cashless / PCI-DSS SAQ A */}
        <div className="flex flex-col gap-3 p-3 rounded-lg border border-[#c9ef75]/30 bg-[#c9ef75]/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold flex items-center gap-1.5 text-[var(--ink)]">
              <Smartphone size={15} className="text-[#123e30] dark:text-[#c9ef75]" /> Cobro con QR Stripe
            </span>
            <span className="text-[10px] text-[#5e8b48] font-medium flex items-center gap-1">
              <ShieldCheck size={12} /> PCI-DSS Seguro
            </span>
          </div>

          <p className="text-[11px] text-[var(--subtle)] leading-relaxed">
            El cliente escanea el QR y paga desde su celular en Stripe. La taquilla nunca ve ni guarda números de tarjeta (PAN) ni códigos de seguridad (PCI-DSS / SEC-01).
          </p>

          <div className="flex items-center gap-2 text-[11px] text-[#123e30] dark:text-[#c9ef75] bg-white/40 dark:bg-black/20 p-2 rounded border border-[var(--line)]">
            <CheckCircle2 size={14} className="shrink-0 text-[#5e8b48]" />
            <span>
              {isTestMode
                ? 'Modo de pruebas de Stripe · no se realizan cobros reales'
                : 'El ticket se habilita al confirmarse el pago'}
            </span>
          </div>
        </div>

        {/* Único cobro: el cliente paga desde su celular (Stripe Checkout) */}
        <Button
          id="btn-pos-alt-link"
          variant="brand"
          size="lg"
          onClick={onGenerateAltLink}
          disabled={isProcessing || !currentService}
          className="w-full text-xs font-bold gap-2"
          type="button"
        >
          {isProcessing ? (
            <span>{processStep || 'Generando el QR de pago...'}</span>
          ) : (
            <>
              <Smartphone size={16} /> Cobrar con QR · {formatMoney(totalFinal)}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
