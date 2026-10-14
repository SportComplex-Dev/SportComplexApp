'use client'

import { AlertCircle, ShieldCheck, Store, User } from 'lucide-react'

interface PosHeaderProps {
  sellerName?: string
}

export function PosHeader({ sellerName }: PosHeaderProps) {
  return (
    <>
      <div className="bg-[#123e30] text-white px-4 py-3 shadow-md border-b border-[#1d6048]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#c9ef75] text-[#19352a] p-2 rounded-lg font-bold flex items-center gap-1.5 text-xs">
              <Store size={16} /> TAQUILLA POS
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Punto de Venta Presencial · 100% Cashless</h1>
              <p className="text-xs text-white/80">Cobro exclusivo con Stripe · Cero efectivo en mostrador (RF-17 / RN-13)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
              <User size={14} className="text-[#c9ef75]" />
              <span>Vendedor: <strong>{sellerName || 'Andrés Muñoz'}</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[#c9ef75] bg-black/20 px-3 py-1.5 rounded-lg border border-[#c9ef75]/30">
              <ShieldCheck size={15} />
              <span>Modelo 100% Sin Efectivo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="mb-6 p-4 rounded-xl border border-[#c9ef75]/40 bg-[#c9ef75]/10 flex items-start gap-3 text-sm">
          <AlertCircle size={20} className="text-[#123e30] dark:text-[#c9ef75] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <strong className="text-[#123e30] dark:text-[#c9ef75]">Política Operativa 100% Cashless (RN-13): </strong>
            Queda estrictamente prohibida la recepción o manipulación de billetes, monedas o fondos de caja física en taquilla. Toda venta se procesa digitalmente por Stripe con tarjeta o enlace alternativo seguro.
          </div>
        </div>
      </div>
    </>
  )
}
