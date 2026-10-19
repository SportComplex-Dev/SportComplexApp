'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Clock, Sparkles, X } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import { formatMoney } from '../utils/formatters'
import type { DynamicTimeSlot } from '../types/cart'
import {
  validateContinuousSlots,
  calculateMultiSlotPricing,
} from '../services/cartUtils'

export interface SlotPickerProps {
  timeSlots: DynamicTimeSlot[]
  selectedSlots: DynamicTimeSlot[]
  onSlotsChange: (slots: DynamicTimeSlot[]) => void
  disabled?: boolean | undefined
  basePricePerHour?: number | undefined
  isMember?: boolean | undefined
  serviceName?: string | undefined
  onValidationError?: ((errorMessage: string) => void) | undefined
  className?: string | undefined
}

/**
 * TSK-FE-31: Selector de horarios con selección múltiple continua y subtotal reactivo.
 * Impide franjas discontinuas y aplica el 30% de descuento a socios.
 */
export function SlotPicker({
  timeSlots,
  selectedSlots: propSelectedSlots,
  onSlotsChange,
  disabled = false,
  basePricePerHour = 48000,
  isMember = false,
  serviceName,
  onValidationError,
  className = '',
}: SlotPickerProps) {
  const [internalSlots, setInternalSlots] = useState<DynamicTimeSlot[]>(propSelectedSlots ?? [])

  useEffect(() => {
    if (propSelectedSlots !== undefined) {
      setInternalSlots(propSelectedSlots)
    }
  }, [propSelectedSlots])

  const selectedSlots = propSelectedSlots ?? internalSlots

  const handleUpdate = (newSlots: DynamicTimeSlot[]) => {
    setInternalSlots(newSlots)
    onSlotsChange(newSlots)
  }

  const shouldReduceMotion = useReducedMotion()

  const sortedSelected = useMemo(() => {
    return [...selectedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [selectedSlots])

  const pricing = useMemo(() => {
    return calculateMultiSlotPricing(basePricePerHour, selectedSlots.length, isMember)
  }, [basePricePerHour, selectedSlots.length, isMember])

  const selectedTimesSet = useMemo(() => {
    return new Set(selectedSlots.map((s) => s.startTime))
  }, [selectedSlots])

  const handleSlotClick = (slot: DynamicTimeSlot, e?: React.MouseEvent) => {
    if (disabled || !slot.isAvailable) return

    const isAlreadySelected = selectedTimesSet.has(slot.startTime)

    // Deselección
    if (isAlreadySelected) {
      if (selectedSlots.length <= 1) {
        handleUpdate([])
        return
      }

      const first = sortedSelected[0]
      const last = sortedSelected[sortedSelected.length - 1]

      if (first && slot.startTime === first.startTime) {
        handleUpdate(sortedSelected.slice(1))
        return
      }
      if (last && slot.startTime === last.startTime) {
        handleUpdate(sortedSelected.slice(0, -1))
        return
      }

      handleUpdate([slot])
      return
    }

    if (selectedSlots.length === 0) {
      handleUpdate([slot])
      return
    }

    const candidateList = [...selectedSlots, slot]
    const continuity = validateContinuousSlots(candidateList)

    if (continuity.valid) {
      handleUpdate(candidateList.sort((a, b) => a.startTime.localeCompare(b.startTime)))
      return
    }

    // Autocompletar rango únicamente con modificador explícito (Shift + Clic)
    if (e?.shiftKey) {
      const allSorted = [...timeSlots].sort((a, b) => a.startTime.localeCompare(b.startTime))
      const firstSelected = sortedSelected[0]
      const lastSelected = sortedSelected[sortedSelected.length - 1]

      if (!firstSelected || !lastSelected) {
        handleUpdate([slot])
        return
      }

      const rangeStart = slot.startTime < firstSelected.startTime ? slot.startTime : firstSelected.startTime
      const rangeEnd = slot.startTime > lastSelected.startTime ? slot.endTime : lastSelected.endTime

      const subRange = allSorted.filter((s) => s.startTime >= rangeStart && s.endTime <= rangeEnd)
      const allAvailable = subRange.every((s) => s.isAvailable)

      if (allAvailable && subRange.length > 0) {
        const rangeCheck = validateContinuousSlots(subRange)
        if (rangeCheck.valid) {
          handleUpdate(subRange)
          return
        }
      }
    }

    // Clic estándar en franja separada o rango no continuo: notificar y cambiar selección a la franja actual
    const msg = 'Las reservas múltiples deben ser continuas (sin huecos intermedios entre horarios).'
    if (onValidationError) {
      onValidationError(msg)
    }
    handleUpdate([slot])
  }

  const rangeLabel = useMemo(() => {
    if (sortedSelected.length === 0) return ''
    const first = sortedSelected[0]
    const last = sortedSelected[sortedSelected.length - 1]
    if (sortedSelected.length === 1 && first) return first.label
    if (first && last) return `${first.startTime} – ${last.endTime}`
    return ''
  }, [sortedSelected])

  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5"
        role="group"
        aria-label="Selector de franjas horarias continuas"
      >
        {timeSlots.map((slot) => {
          const isSelected = selectedTimesSet.has(slot.startTime)
          const isBlocked = disabled || !slot.isAvailable

          return (
            <motion.button
              key={slot.startTime}
              type="button"
              disabled={isBlocked}
              onClick={(e) => handleSlotClick(slot, e)}
              aria-pressed={isSelected}
              aria-disabled={isBlocked}
              {...(!isBlocked && !shouldReduceMotion ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.97 } } : {})}
              className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[82px] cursor-pointer ${
                isBlocked
                  ? 'cursor-not-allowed border-[var(--line)] bg-[var(--surface-soft)]/50 opacity-50 text-[var(--subtle)]'
                  : isSelected
                  ? 'border-[#557b53] dark:border-[#9ee285] bg-[#edf5e2] dark:bg-[#1f2e1e] ring-2 ring-[#557b53]/40 shadow-xs'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[#557b53]/60 hover:bg-[var(--surface-soft)]'
              }`}
            >
              <div className="text-xs font-bold text-[var(--ink)] flex items-center gap-1">
                {slot.startTime}
                {isSelected && <Check size={13} className="text-[#557b53] dark:text-[#9ee285]" />}
              </div>
              <div className="text-[11px] text-[var(--subtle)]">
                hasta {slot.endTime}
              </div>
              <Badge
                variant={isSelected ? 'success' : isBlocked ? 'secondary' : 'outline'}
                className="text-[10px] uppercase font-bold py-0.5 px-1.5"
              >
                {isSelected ? 'Elegida' : isBlocked ? 'Ocupada' : 'Libre'}
              </Badge>
            </motion.button>
          )
        })}
      </div>

      {/* Resumen reactivo de subtotal y rango continuo (TSK-FE-31) */}
      {selectedSlots.length > 0 && (
        <div
          data-testid="slot-picker-summary"
          className="rounded-2xl border border-[#557b53]/30 bg-[#f4f8f1] dark:bg-[#162215] p-4 text-[var(--ink)] shadow-xs transition-all"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#557b53]/15 text-[#557b53] dark:text-[#9ee285]">
                <Clock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--ink)]">
                    {selectedSlots.length} {selectedSlots.length === 1 ? 'hora reservada' : 'horas continuas'}
                  </span>
                  {serviceName && (
                    <span className="text-xs text-[var(--subtle)]">· {serviceName}</span>
                  )}
                  {isMember && (
                    <Badge variant="success" className="gap-1 text-[10px] font-bold">
                      <Sparkles size={11} /> 30% Descuento Socio Activo
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-[var(--subtle)] font-medium">
                  Rango horario: <strong className="text-[var(--ink)]">{rangeLabel}</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-right">
              <button
                type="button"
                onClick={() => handleUpdate([])}
                className="text-xs text-[var(--subtle)] hover:text-red-500 underline flex items-center gap-1 cursor-pointer"
              >
                <X size={12} /> Limpiar horarios
              </button>
              {pricing.discountAmount > 0 && (
                <div className="text-xs text-[var(--subtle)] line-through">
                  {formatMoney(pricing.subtotal)}
                </div>
              )}
              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase block font-semibold">
                  Subtotal acumulado
                </span>
                <span className="text-base font-black text-[#557b53] dark:text-[#9ee285]">
                  {formatMoney(pricing.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
