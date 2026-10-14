'use client'

import { useState } from 'react'
import { CalendarDays, SlidersHorizontal } from 'lucide-react'
import {
  generateOperatingSlots,
  type CatalogItem,
  type GeneratedOperatingSlot,
  type OperatingScheduleConfig,
} from '@sportcomplex/core'
import { ActionButton } from '@/components/action-button'

interface CatalogScheduleViewProps {
  selectedService: CatalogItem
  selectedConfig: OperatingScheduleConfig
  onEditSchedule: (item: CatalogItem) => void
}

export function CatalogScheduleView({
  selectedService,
  selectedConfig,
  onEditSchedule,
}: CatalogScheduleViewProps) {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0)

  const generatedSlots: GeneratedOperatingSlot[] = generateOperatingSlots(selectedConfig)

  // Días de la semana para previsualizar el calendario
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() + index)
    return {
      offset: index,
      name: date.toLocaleDateString('es-CO', { weekday: 'short' }),
      dateStr: date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      isToday: index === 0,
    }
  })

  return (
    <section className="demo-card mt-8">
      <div className="demo-card-heading flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-[var(--brand-accent)]" />
            <h2>Calendario Operativo Autónomo — {selectedService.name}</h2>
          </div>
          <p>
            Criterios Clave: Dispone de su propio calendario independiente (HU-04) con franjas de 60 min (06:00 a 22:00)
            y aforo parametrizado (<b>{selectedConfig.capacity} personas</b>) reflejado al instante tras guardar en BD (HU-05).
          </p>
        </div>
        <ActionButton
          secondary
          size="sm"
          onClick={() => onEditSchedule(selectedService)}
        >
          <SlidersHorizontal size={14} /> Modificar Aforo & Franjas
        </ActionButton>
      </div>

      {/* Selector de días de la semana */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-[var(--line)] no-scrollbar">
        {weekDays.map((day) => (
          <button
            key={day.offset}
            type="button"
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center min-w-[70px] border transition-all ${
              selectedDayOffset === day.offset
                ? 'border-[var(--brand-accent)] bg-[var(--surface-soft)] text-[var(--brand-accent)] shadow-sm'
                : 'border-[var(--line)] text-subtle hover:text-ink'
            }`}
            onClick={() => setSelectedDayOffset(day.offset)}
          >
            <span className="uppercase text-[10px] tracking-wider">{day.name}</span>
            <span className="font-bold text-sm">{day.dateStr}</span>
            {day.isToday && (
              <span className="text-[9px] text-[var(--brand-accent)] font-medium mt-0.5">Hoy</span>
            )}
          </button>
        ))}
      </div>

      {/* Matriz reactiva de franjas horarias de 60 min */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {generatedSlots.map((slot) => {
          const isSlotDisabled = !slot.isAvailable

          return (
            <div
              key={slot.time}
              className={`p-2.5 rounded-lg border text-center transition-all ${
                isSlotDisabled
                  ? 'border-destructive/30 bg-destructive/5 opacity-70'
                  : 'border-[var(--line)] bg-[var(--surface)] hover:border-brand-accent shadow-xs'
              }`}
            >
              <div className="text-xs font-bold text-ink">{slot.label}</div>
              <div className="text-[11px] text-subtle mt-1">
                {isSlotDisabled ? (
                  <span className="text-destructive font-medium">Pausada</span>
                ) : (
                  <span>
                    <b>{slot.capacity}</b> cupos
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex justify-center">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isSlotDisabled
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSlotDisabled ? 'bg-destructive' : 'bg-emerald-500'
                    }`}
                  />
                  {isSlotDisabled ? 'Mantenimiento' : 'Habilitada'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
