'use client'

import { useEffect, useState } from 'react'
import type { Booking } from '@sportcomplex/core'
import {
  getAccessWindowLabel,
  getAccessWindowStatus,
  type PortalTicket,
} from '@/components/portal/portal-utils'

type AccessWindowIndicatorProps = Pick<Booking, 'date' | 'time'> &
  Partial<Pick<PortalTicket, 'accessWindowStart' | 'accessWindowEnd'>> & {
    compact?: boolean
  }

const statusPresentation = {
  UPCOMING: {
    label: 'Franja Próxima',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  OPEN: {
    label: 'Acceso Abierto',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  EXPIRED: {
    label: 'Franja Vencida',
    className: 'border-rose-300 bg-rose-50 text-rose-800',
  },
} as const

export function AccessWindowIndicator({
  date,
  time,
  accessWindowStart,
  accessWindowEnd,
  compact = false,
}: AccessWindowIndicatorProps) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!now) return null

  const ticket = { date, time, accessWindowStart, accessWindowEnd }
  const status = getAccessWindowStatus(ticket, now)
  const windowLabel = getAccessWindowLabel(ticket)
  if (!status || !windowLabel) return null

  const presentation = statusPresentation[status]
  return (
    <div className={compact ? 'mt-2 flex flex-wrap items-center gap-2' : 'mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3'}>
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${presentation.className}`}>
        {presentation.label}
      </span>
      <span className="text-xs text-[var(--subtle)]">
        Ventana de entrada: <strong className="text-[var(--ink)]">{windowLabel}</strong> · Hora Colombia (UTC-5)
      </span>
      {status === 'EXPIRED' && (
        <span className="basis-full text-xs text-[var(--subtle)]">
          El boleto permanece EMITIDO; el acceso requiere estar dentro de esta franja.
        </span>
      )}
    </div>
  )
}
