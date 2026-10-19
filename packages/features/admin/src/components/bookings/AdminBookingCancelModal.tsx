'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Ban } from 'lucide-react'
import { Modal, ActionButton } from '@sportcomplex/ui'
import type { AdminBookingItem } from './types'

export interface AdminBookingCancelModalProps {
  booking: AdminBookingItem | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (bookingId: string, motivo: string) => Promise<void>
  isLoading?: boolean
}

export function AdminBookingCancelModal({
  booking,
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: AdminBookingCancelModalProps) {
  const [motivo, setMotivo] = useState('')
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  if (!isOpen || !booking) return null

  const trimmed = motivo.trim()
  const isValidMotivo = trimmed.length >= 10 && trimmed.length <= 500

  const handleConfirm = async () => {
    if (!isValidMotivo) {
      setErrorLocal('El motivo debe tener al menos 10 caracteres justificando la anulación.')
      return
    }
    setErrorLocal(null)
    await onConfirm(booking.id, trimmed)
  }

  const handleClose = () => {
    if (isLoading) return
    setMotivo('')
    setErrorLocal(null)
    onClose()
  }

  return (
    <Modal
      title="Cancelar Reserva Administrativamente"
      description="Esta acción cambiará el estado a CANCELADA_ADMINISTRATIVA y liberará inmediatamente los cupos en la base de datos."
      onClose={handleClose}
      maxWidth="500px"
    >
      <div className="space-y-4 pt-1 text-xs">
        {/* Resumen de la Reserva */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
          <div className="space-y-0.5">
            <span className="font-bold block">Acción con impacto transaccional (RN-12)</span>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
              Titular: <b>{booking.titular?.nombre}</b> · Recinto: <b>{booking.disponibilidad?.servicio?.nombre}</b>
            </p>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80">
              Cupos a liberar: <b>{booking.cantidadCupos}</b> · Total: <b>${booking.total.toLocaleString('es-CO')}</b>
            </p>
          </div>
        </div>

        {/* Motivo Obligatorio */}
        <div className="space-y-1.5">
          <label htmlFor="cancel-motivo" className="font-bold text-[11px] uppercase tracking-wider text-[var(--ink)] block">
            Motivo justificado de la anulación <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="cancel-motivo"
            rows={3}
            disabled={isLoading}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              if (errorLocal) setErrorLocal(null)
            }}
            placeholder="Ej: Daño técnico en la pista, inhabilitación climática o solicitud formal del cliente..."
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-3 text-xs text-[var(--ink)] placeholder:text-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all resize-none"
          />
          <div className="flex justify-between items-center text-[10px] text-[var(--subtle)]">
            <span>Mínimo 10 caracteres obligatorios</span>
            <span className={trimmed.length < 10 ? 'text-rose-500 font-semibold' : 'text-emerald-500 font-semibold'}>
              {trimmed.length}/500
            </span>
          </div>
          {errorLocal && (
            <p className="text-rose-500 text-[11px] font-semibold mt-1">{errorLocal}</p>
          )}
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
          <ActionButton
            secondary
            disabled={isLoading}
            onClick={handleClose}
          >
            Volver
          </ActionButton>

          <button
            type="button"
            disabled={!isValidMotivo || isLoading}
            onClick={handleConfirm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Anulando...
              </>
            ) : (
              <>
                <Ban size={13} /> Confirmar Cancelación
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
