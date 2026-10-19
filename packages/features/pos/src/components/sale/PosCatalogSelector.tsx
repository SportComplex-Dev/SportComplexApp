'use client'

import { motion, AnimatePresence } from 'motion/react'
import { Badge, Card, CardContent, CardHeader, CardTitle, Input } from '@sportcomplex/ui'
import { serviceCategories, type CatalogItem, type CategoryIcon } from '@sportcomplex/core'
import { ServiceSelector, formatMoney } from '@sportcomplex/features-booking'
import { Dumbbell, Footprints, Sparkles, Waves, type LucideIcon } from 'lucide-react'

export { ServiceSelector }

export const categoryIcons: Record<CategoryIcon, LucideIcon> = {
  court: Footprints,
  pool: Waves,
  gym: Dumbbell,
  wellness: Sparkles,
}

export interface PosCatalogSelectorProps {
  selectedCategory: string
  onSelectCategory: (category: string) => void
  selectedServiceId: string
  onSelectServiceId: (id: string) => void
  selectedDate: string
  onSelectDate: (date: string) => void
  selectedSlot: string
  onSelectSlot: (slot: string) => void
  attendees: number
  onSetAttendees: (qty: number) => void
  filteredServices: CatalogItem[]
  currentService?: CatalogItem
  todayStr: string
  availableSlots: string[]
  isLoadingSlots?: boolean
}

export function PosCatalogSelector({
  selectedCategory,
  onSelectCategory,
  selectedServiceId,
  onSelectServiceId,
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  attendees,
  onSetAttendees,
  filteredServices,
  currentService,
  todayStr,
  availableSlots,
  isLoadingSlots = false,
}: PosCatalogSelectorProps) {
  return (
    <Card className="border border-[var(--line)] shadow-sm bg-[var(--surface)]">
      <CardHeader className="pb-3 border-b border-[var(--line)]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="flex items-center justify-center size-6 rounded-full bg-[#123e30] text-[#c9ef75] text-xs font-bold">1</span>
            Servicio y Disponibilidad
          </CardTitle>
          <Badge variant="outline" className="text-xs">Paso 1 de 3</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex flex-col gap-4">
        {/* Selector de categorías */}
        <div>
          <span id="label-sport-cat" className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)] mb-2 block">
            Categoría Deportiva
          </span>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-labelledby="label-sport-cat">
            {serviceCategories.map((cat) => {
              const Icon = categoryIcons[cat.icon]
              const isSelected = selectedCategory === cat.slug
              return (
                <motion.button
                  key={cat.slug}
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  id={`pos-cat-${cat.slug}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onSelectCategory(cat.slug)
                    onSelectServiceId('')
                  }}
                  className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 transition-all border ${
                    isSelected
                      ? 'bg-[#123e30] text-white border-[#123e30] shadow-sm'
                      : 'bg-[var(--surface-soft)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
                  }`}
                >
                  <Icon size={16} />
                  <span className="truncate w-full text-center text-[11px]">{cat.name.split(' ')[0]}</span>
                </motion.button>
              )
            })}
          </div>
        </div>

        {/* Servicios de la categoría con Transición */}
        <div>
          <span id="label-service-space" className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)] mb-2 block">
            Servicio / Espacio
          </span>
          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1" role="group" aria-labelledby="label-service-space">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                className="flex flex-col gap-2"
              >
                {filteredServices.length === 0 ? (
                  <p className="text-xs text-[var(--subtle)] p-3 text-center">No hay servicios disponibles en esta categoría.</p>
                ) : (
                  filteredServices.map((item) => {
                    const isSelected = (selectedServiceId ? selectedServiceId === item.id : currentService?.id === item.id)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        id={`pos-service-${item.id}`}
                        aria-pressed={isSelected}
                        onClick={() => onSelectServiceId(item.id)}
                        className={`p-3 rounded-lg text-left flex items-center justify-between transition-all border ${
                          isSelected
                            ? 'bg-[#c9ef75]/15 border-[#123e30] dark:border-[#c9ef75]'
                            : 'bg-[var(--surface-soft)] border-transparent hover:border-[var(--line)]'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-xs text-[var(--ink)]">{item.name}</div>
                          <div className="text-[11px] text-[var(--subtle)] flex items-center gap-2 mt-0.5">
                            <span>{item.sede}</span> · <span>Cap: {item.capacity}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs text-[#123e30] dark:text-[#c9ef75]">{formatMoney(item.price)}</span>
                          <div className="text-[10px] text-[var(--subtle)]">por turno</div>
                        </div>
                      </button>
                    )
                  })
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Selección de Fecha */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="pos-date-input" className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)]">
              Fecha del Servicio
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onSelectDate(todayStr)}
                className={`text-[11px] px-2 py-0.5 rounded border ${
                  selectedDate === todayStr ? 'bg-[#123e30] text-white border-[#123e30]' : 'border-[var(--line)]'
                }`}
              >
                Hoy
              </button>
            </div>
          </div>
          <Input
            id="pos-date-input"
            type="date"
            value={selectedDate}
            min={todayStr}
            onChange={(e) => onSelectDate(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Franjas Horarias */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span id="label-time-slots" className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)]">
              Franja Horaria Disponible
            </span>
            {isLoadingSlots && <span className="text-[10px] text-[var(--subtle)] animate-pulse">Consultando aforo...</span>}
          </div>
          <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1" role="group" aria-labelledby="label-time-slots">
            {availableSlots.map((slot) => {
              const isSelected = selectedSlot === slot
              return (
                <button
                  key={slot}
                  type="button"
                  id={`pos-slot-${slot.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`}
                  aria-pressed={isSelected}
                  onClick={() => onSelectSlot(slot)}
                  className={`p-2 rounded text-xs font-medium text-center transition-all border ${
                    isSelected
                      ? 'bg-[#123e30] text-white border-[#123e30] font-semibold'
                      : 'bg-[var(--surface-soft)] text-[var(--ink)] border-[var(--line)] hover:border-black/30'
                  }`}
                >
                  {slot.split(' - ')[0]}
                </button>
              )
            })}
            {availableSlots.length === 0 && !isLoadingSlots && (
              <p className="text-[11px] text-[var(--subtle)] col-span-2 py-3 text-center bg-[var(--surface-soft)] rounded-lg border border-[var(--line)]">
                No hay franjas disponibles registradas para esta fecha.
              </p>
            )}
          </div>
        </div>

        {/* Selector de Cupos / Asistentes */}
        {currentService?.category !== 'canchas' && (
          <div>
            <div className="flex items-center justify-between">
              <span id="label-pos-attendees" className="text-xs font-semibold uppercase tracking-wider text-[var(--subtle)]">
                Cantidad de Cupos
              </span>
              <div className="flex items-center gap-2" role="group" aria-labelledby="label-pos-attendees">
                <button
                  type="button"
                  aria-label="Disminuir cupos"
                  onClick={() => onSetAttendees(Math.max(1, attendees - 1))}
                  className="size-7 rounded bg-[var(--surface-soft)] border border-[var(--line)] font-bold flex items-center justify-center text-xs hover:bg-[var(--line)]"
                >
                  -
                </button>
                <span className="font-bold text-xs min-w-5 text-center" aria-live="polite">{attendees}</span>
                <button
                  type="button"
                  aria-label="Aumentar cupos"
                  onClick={() => onSetAttendees(Math.min(currentService?.capacity || 10, attendees + 1))}
                  className="size-7 rounded bg-[var(--surface-soft)] border border-[var(--line)] font-bold flex items-center justify-center text-xs hover:bg-[var(--line)]"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
