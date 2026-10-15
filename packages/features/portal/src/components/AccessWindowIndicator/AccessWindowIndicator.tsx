'use client'

import { useEffect, useState } from 'react'
import type { Booking } from '@sportcomplex/core'
import {
  getAccessWindowLabel,
  getAccessWindowStatus,
  type AccessWindowStatus,
} from '../../utils/portal-utils'

export type AccessWindowIndicatorStatus =
  | AccessWindowStatus
  | 'HABILITADO'
  | 'ANTICIPADO'
  | 'EXPIRADO'

export interface AccessWindowIndicatorProps extends Pick<Booking, 'date' | 'time'> {
  accessWindowStart?: string | undefined
  accessWindowEnd?: string | undefined
  compact?: boolean | undefined
  status?: AccessWindowIndicatorStatus | undefined
  now?: Date | undefined
}

const statusPresentation: Record<
  AccessWindowIndicatorStatus,
  { label: string; className: string }
> = {
  UPCOMING: {
    label: 'Franja Próxima',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  ANTICIPADO: {
    label: 'Franja Próxima',
    className: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  OPEN: {
    label: 'Acceso Abierto',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  HABILITADO: {
    label: 'ACCESO HABILITADO',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  EXPIRED: {
    label: 'Franja Vencida',
    className: 'border-rose-300 bg-rose-50 text-rose-800',
  },
  EXPIRADO: {
    label: 'Franja Vencida',
    className: 'border-rose-300 bg-rose-50 text-rose-800',
  },
}

export function AccessWindowIndicator({
  date,
  time,
  accessWindowStart,
  accessWindowEnd,
  compact = false,
  status: explicitStatus,
  now: explicitNow,
}: AccessWindowIndicatorProps) {
  const [now, setNow] = useState<Date | null>(() => {
    if (explicitNow) return explicitNow
    // Default to current date in SSR so renderToStaticMarkup renders content
    return typeof window === 'undefined' ? new Date() : null
  })

  useEffect(() => {
    if (explicitNow) {
      setNow(explicitNow)
      return
    }
    setNow(new Date())
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [explicitNow])

  const ticket = { date, time, accessWindowStart, accessWindowEnd }
  const effectiveStatus: AccessWindowIndicatorStatus | null =
    explicitStatus ?? (now ? getAccessWindowStatus(ticket, now) : null)
  const windowLabel = getAccessWindowLabel(ticket)

  if (!effectiveStatus || !windowLabel) return null

  const presentation = statusPresentation[effectiveStatus] ?? statusPresentation.OPEN
  return (
    <div className={compact ? 'mt-2 flex flex-wrap items-center gap-2' : 'mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3'}>
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${presentation.className}`}>
        {presentation.label}
      </span>
      <span className="text-xs text-[var(--subtle)]">
        Ventana de entrada: <strong className="text-[var(--ink)]">{windowLabel}</strong> · Hora Colombia (UTC-5)
      </span>
      {(effectiveStatus === 'EXPIRED' || effectiveStatus === 'EXPIRADO') && (
        <span className="basis-full text-xs text-[var(--subtle)]">
          El boleto permanece EMITIDO; el acceso requiere estar dentro de esta franja.
        </span>
      )}
    </div>
  )
}
