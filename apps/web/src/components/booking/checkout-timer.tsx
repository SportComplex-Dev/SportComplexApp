'use client'

import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Clock, Hourglass, RotateCcw, XCircle } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import {
  CHECKOUT_TTL_SECONDS,
  formatCountdown,
  calculateRemainingSeconds,
  getTimerStatus,
  calculateProgressPercentage,
} from './checkout-timer-utils'

export interface CheckoutTimerProps {
  /** Timestamp en milisegundos cuando la reserva expira */
  expiresAt?: number
  /** Segundos iniciales por defecto (1800 = 30 minutos según HU-09 / TSK-FE-09) */
  initialSeconds?: number
  /** Callback ejecutado cuando el contador llega a cero */
  onExpire?: () => void
  /** Callback para reintentar la reserva tras expiración */
  onRetry?: () => void
  /** Flag forzado de expiración */
  isExpired?: boolean
  className?: string
}

export function CheckoutTimer({
  expiresAt,
  initialSeconds = CHECKOUT_TTL_SECONDS,
  onExpire,
  onRetry,
  isExpired: forcedExpired,
  className = '',
}: CheckoutTimerProps) {
  // Calculamos los segundos restantes
  const calculateRemaining = (): number => {
    if (forcedExpired) return 0
    return calculateRemainingSeconds(expiresAt, Date.now(), initialSeconds)
  }

  const [remaining, setRemaining] = useState<number>(calculateRemaining)
  const [hasNotifiedExpire, setHasNotifiedExpire] = useState(false)

  useEffect(() => {
    if (forcedExpired) {
      setRemaining(0)
      return
    }

    const interval = setInterval(() => {
      const nextRemaining = calculateRemaining()
      setRemaining(nextRemaining)

      if (nextRemaining <= 0) {
        clearInterval(interval)
        if (!hasNotifiedExpire) {
          setHasNotifiedExpire(true)
          onExpire?.()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiresAt, forcedExpired, hasNotifiedExpire, onExpire, initialSeconds])

  const status = getTimerStatus(forcedExpired ? 0 : remaining)
  const isExpired = status === 'expired'
  const isWarning = status === 'warning'

  const formattedTime = useMemo(() => formatCountdown(remaining), [remaining])
  const percentRemaining = useMemo(
    () => calculateProgressPercentage(remaining, initialSeconds),
    [remaining, initialSeconds]
  )

  return (
    <div className={`checkout-timer-card ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isExpired
                ? 'bg-red-500/10 text-red-500'
                : isWarning
                  ? 'bg-amber-500/10 text-amber-500 animate-pulse'
                  : 'bg-[var(--surface-soft)] text-[#4b7652] dark:text-[#9ee285]'
            }`}
          >
            {isExpired ? (
              <XCircle size={22} />
            ) : isWarning ? (
              <AlertTriangle size={22} />
            ) : (
              <Hourglass size={20} className="animate-spin-slow" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-[var(--ink)]">
                {isExpired
                  ? 'Cupo liberado'
                  : isWarning
                    ? 'Cupo por expirar'
                    : 'Cupo bloqueado temporalmente'}
              </span>
              <Badge
                variant={isExpired ? 'destructive' : isWarning ? 'secondary' : 'default'}
                className="text-[10px] px-2 py-0.5 tracking-wider font-semibold uppercase"
              >
                {isExpired ? 'Expirado' : isWarning ? 'Urgente' : 'Activo'}
              </Badge>
            </div>
            <p className="text-[11.5px] text-[var(--subtle)] mt-0.5">
              {isExpired
                ? 'El tiempo para completar el pago ha finalizado. El horario ya no está reservado.'
                : 'Tu turno está asegurado mientras completas los datos de pago.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <div
            role="timer"
            aria-live="polite"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-mono font-bold text-[18px] border ${
              isExpired
                ? 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400'
                : isWarning
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)]'
            }`}
          >
            <Clock size={16} className={isWarning ? 'animate-bounce' : ''} />
            <span>{formattedTime}</span>
          </div>

          {isExpired && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surface-soft)] hover:bg-[var(--line)] text-[var(--ink)] transition-colors cursor-pointer"
            >
              <RotateCcw size={13} /> Reintentar
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso de tiempo */}
      {!isExpired && (
        <div className="w-full bg-[var(--line)] h-1 rounded-b-xl overflow-hidden -mt-1">
          <div
            className={`h-full transition-all duration-1000 ${
              isWarning ? 'bg-amber-500' : 'bg-[#557b53] dark:bg-[#8cd766]'
            }`}
            style={{ width: `${percentRemaining}%` }}
          />
        </div>
      )}

      {/* Alerta si el tiempo expiró */}
      {isExpired && (
        <div className="mt-3 p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300 flex items-start justify-between gap-3 animate-in fade-in">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
            <div>
              <strong className="text-[13px] block">Tiempo de reserva agotado</strong>
              <span className="text-[12px] opacity-90">
                Por políticas de disponibilidad y rotación de canchas/escenarios, el cupo ha sido liberado para permitir que otros deportistas puedan reservarlo.
              </span>
            </div>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer shadow-sm"
            >
              <RotateCcw size={14} /> Seleccionar nuevo turno
            </button>
          )}
        </div>
      )}
    </div>
  )
}
