'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Lock,
  ShieldAlert,
  Sparkles,
  Users,
  Waves,
} from 'lucide-react'
import {
  getBookingCalendarDays,
  isPoolMaintenanceDay,
  type BookingCalendarDay,
  type CatalogItem,
  type GeneratedOperatingSlot,
  type OperatingScheduleConfig,
  type PoolMaintenanceResult,
} from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'

interface AvailabilityCalendarProps {
  service: CatalogItem
  scheduleConfig?: OperatingScheduleConfig
  selectedDate: string
  selectedSlotTime: string
  onSelectDate: (dateISO: string) => void
  onSelectSlot: (slot: GeneratedOperatingSlot) => void
}

interface HolidayItem {
  date: string
  name: string
  localName?: string
}

export function AvailabilityCalendar({
  service,
  scheduleConfig,
  selectedDate,
  selectedSlotTime,
  onSelectDate,
  onSelectSlot,
}: AvailabilityCalendarProps) {
  const [holidays, setHolidays] = useState<HolidayItem[]>([])

  // 1. Cargar festivos oficiales de Colombia (patrón Cache-Aside vía API /api/holidays)
  useEffect(() => {
    let isMounted = true
    const currentYear = new Date().getFullYear()

    fetch(`/api/holidays?year=${currentYear}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.holidays) {
          setHolidays(data.holidays)
        }
      })
      .catch((err) => {
        console.warn('Error al cargar festivos, continuando con lista local:', err)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 2. Generar días con restricción estricta de ventana de 15 días en America/Bogota (TSK-FE-06 / RN-01)
  const calendarDays: BookingCalendarDay[] = useMemo(() => {
    return getBookingCalendarDays(15, 20)
  }, [])

  const maxAllowedDate = useMemo(() => {
    const day15 = calendarDays.find((d) => d.daysAhead === 15)
    return day15 ? day15.dateISO : ''
  }, [calendarDays])

  // 3. Determinar si el servicio es de piscina y evaluar mantenimiento (TSK-FE-07 / RN-02)
  const isPool = service.category === 'piscinas'
  const isPrivatePool =
    isPool && (service.poolType === 'PRIVADA' || service.capacity === 1)

  const poolMaintenance: PoolMaintenanceResult = useMemo(() => {
    if (!isPool || !selectedDate) return { blocked: false }
    return isPoolMaintenanceDay(selectedDate, holidays)
  }, [isPool, selectedDate, holidays])

  // 4. Ranuras horarias generadas de 60 min (06:00 - 22:00)
  const slots: GeneratedOperatingSlot[] = useMemo(() => {
    const startHour = scheduleConfig?.startHour ?? 6
    const endHour = scheduleConfig?.endHour ?? 22
    const disabledSlots = scheduleConfig?.disabledSlots ?? []
    const capacity = scheduleConfig?.capacity ?? service.capacity ?? 4
    const isShared = isPool ? !isPrivatePool : (scheduleConfig?.isShared ?? (capacity > 1))

    const list: GeneratedOperatingSlot[] = []
    const pad = (n: number) => String(n).padStart(2, '0')

    for (let h = startHour; h < endHour; h++) {
      const timeStr = `${pad(h)}:00`
      const nextStr = `${pad(h + 1)}:00`
      const isConfigDisabled = disabledSlots.includes(timeStr)

      // Si es piscina y hay mantenimiento hoy, todas las franjas están bloqueadas
      const isMaintenanceBlocked = isPool && poolMaintenance.blocked
      const isAvailable = !isConfigDisabled && !isMaintenanceBlocked

      let disabledReason: string | undefined
      if (isPool && poolMaintenance.blocked) {
        disabledReason =
          poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES'
            ? 'Mantenimiento trasladado (festivo)'
            : 'Mantenimiento rutinario'
      } else if (isConfigDisabled) {
        disabledReason = 'Pausada por administración'
      }

      list.push({
        time: timeStr,
        endTime: nextStr,
        label: `${timeStr} – ${nextStr}`,
        startHour: h,
        endHour: h + 1,
        capacity,
        isShared,
        isAvailable,
        disabledReason,
      })
    }

    return list
  }, [scheduleConfig, service, isPool, isPrivatePool, poolMaintenance])

  const selectedDayObj = calendarDays.find((d) => d.dateISO === selectedDate)

  return (
    <div className="availability-calendar-wrapper flex flex-col gap-6">
      {/* Selector de Fechas con límite estricto de 15 días (TSK-FE-06 / RF-05) */}
      <section className="calendar-date-selector">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-brand-accent" />
              <h3 className="text-base font-bold text-ink">Selector de Fecha</h3>
              <Badge variant="outline" className="text-[11px] font-semibold border-brand-accent text-brand-accent">
                Ventana máx. 15 días (RN-01)
              </Badge>
            </div>
            <p className="text-xs text-subtle mt-0.5">
              Zona horaria legal: <b>America/Bogota (UTC-5)</b>. Días posteriores a {maxAllowedDate || 'T+15'} deshabilitados automáticamente.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible
            </span>
            <span className="inline-flex items-center gap-1 text-subtle font-medium">
              <span className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-600" /> Fuera de ventana
            </span>
          </div>
        </div>

        {/* Carrusel de Días Horizontal */}
        <div className="flex gap-2 overflow-x-auto pb-3 pt-1 scrollbar-thin">
          {calendarDays.map((day) => {
            const isSelected = selectedDate === day.dateISO
            const isDisabled = day.isBeyondWindow || day.isPast

            return (
              <button
                key={day.dateISO}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelectDate(day.dateISO)}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
                title={
                  day.isBeyondWindow
                    ? `Día +${day.daysAhead}: Excede la ventana máxima de 15 días permitida por el complejo (RN-01 / RF-05)`
                    : `Seleccionar ${day.weekdayFull} ${day.dayNumber} de ${day.monthFull}`
                }
                className={`relative flex flex-col items-center justify-center min-w-[76px] py-2.5 px-2 rounded-xl border transition-all text-center select-none ${
                  isDisabled
                    ? 'border-dashed border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                    : isSelected
                    ? 'border-brand-accent bg-brand-accent text-content-on-accent shadow-md scale-[1.02]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-ink hover:border-brand-accent hover:shadow-xs'
                }`}
              >
                {/* Etiqueta Hoy / Días restantes */}
                {day.isToday && (
                  <span
                    className={`absolute -top-2 px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                      isSelected
                        ? 'bg-ink text-surface'
                        : 'bg-brand-accent text-content-on-accent'
                    }`}
                  >
                    Hoy
                  </span>
                )}

                {day.isBeyondWindow && (
                  <span className="absolute -top-2 px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    +15d
                  </span>
                )}

                <span
                  className={`text-[11px] font-semibold uppercase tracking-wider ${
                    isSelected ? 'text-content-on-accent/90' : 'text-subtle'
                  }`}
                >
                  {day.weekdayShort}
                </span>

                <span className="text-lg font-extrabold my-0.5 leading-tight">
                  {day.dayNumber}
                </span>

                <span
                  className={`text-[10px] ${
                    isSelected ? 'text-content-on-accent/80' : 'text-subtle'
                  }`}
                >
                  {day.monthShort}
                </span>

                {isDisabled && (
                  <Lock size={10} className="mt-1 text-slate-400 dark:text-slate-600" />
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Banner de Señalización de Mantenimiento de Piscinas (TSK-FE-07 / HU-07) */}
      {isPool && poolMaintenance.blocked && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all animate-in fade-in-50 ${
            poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES'
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              : 'bg-orange-500/10 border-orange-500/30 text-orange-900 dark:text-orange-200'
          }`}
        >
          <ShieldAlert className="w-5 h-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm">
                {poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES'
                  ? 'Mantenimiento trasladado (festivo)'
                  : 'Mantenimiento rutinario semanal'}
              </span>
              <Badge
                variant={
                  poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES'
                    ? 'warning'
                    : 'destructive'
                }
                className="text-[10px] uppercase font-bold"
              >
                {poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES'
                  ? 'Martes Cerrado'
                  : 'Lunes Cerrado'}
              </Badge>
            </div>
            <p className="leading-relaxed opacity-95">
              {poolMaintenance.reason === 'MANTENIMIENTO_TRASLADADO_MARTES' ? (
                <>
                  <b>Regla de Negocio RN-02 (HU-07):</b> El mantenimiento preventivo y limpieza de la piscina se trasladó automáticamente a hoy <b>martes</b> porque el lunes anterior fue día festivo oficial en Colombia (abierto para usuarios).
                </>
              ) : (
                <>
                  <b>Regla de Negocio RN-02 (HU-07):</b> Las piscinas se cierran todos los lunes por mantenimiento rutinario y tratamiento químico del agua. No hay franjas disponibles para reservas en esta fecha.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Banner Informativo de Lunes Festivo Abierto */}
      {isPool && !poolMaintenance.blocked && selectedDayObj?.weekdayShort?.toLowerCase().startsWith('lun') && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 flex items-center gap-3 text-xs">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">¡Lunes Festivo Abierto para Reservas!</span> Piscina habilitada con horario habitual por puente festivo nacional (el mantenimiento se trasladará al martes - RN-02).
          </div>
        </div>
      )}

      {/* Matriz de Franjas Horarias con Contador de Aforo o Exclusividad (TSK-FE-08 / RF-07) */}
      <section className="calendar-slots-grid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-brand-accent" />
              <h3 className="text-base font-bold text-ink">Franjas Horarias (Turnos de 60 min)</h3>
              {/* Badge de Modalidad (TSK-FE-08) */}
              {isPool && (
                <Badge
                  variant={isPrivatePool ? 'secondary' : 'success'}
                  className="text-[11px] font-semibold"
                >
                  <Waves size={11} className="mr-1 inline" />
                  {isPrivatePool ? 'Piscina Privada (Exclusiva)' : 'Piscina Pública (Aforo)'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-subtle mt-0.5">
              {selectedDayObj
                ? `${selectedDayObj.weekdayFull}, ${selectedDayObj.dayNumber} de ${selectedDayObj.monthFull} de ${selectedDayObj.year}`
                : 'Selecciona una fecha'}
            </p>
          </div>

          {/* Leyenda explicativa de cupos y modalidad */}
          <div className="flex items-center gap-3 text-xs text-subtle">
            {isPrivatePool ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <CheckCircle2 size={13} className="text-brand-accent" />
                Modalidad exclusiva: franja 100% reservada para el titular
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <Users size={13} className="text-brand-accent" />
                Aforo máximo: {scheduleConfig?.capacity ?? service.capacity} concurrentes
              </span>
            )}
          </div>
        </div>

        {/* Grilla de Ranuras */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {slots.map((slot) => {
            const isSelected = selectedSlotTime === slot.time
            const isDisabled = !slot.isAvailable

            return (
              <button
                key={slot.time}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && onSelectSlot(slot)}
                aria-pressed={isSelected}
                aria-disabled={isDisabled}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[92px] ${
                  isDisabled
                    ? 'border-dashed border-destructive/30 bg-destructive/5 text-subtle opacity-75 cursor-not-allowed'
                    : isSelected
                    ? 'border-brand-accent bg-[var(--surface-soft)] ring-2 ring-brand-accent shadow-xs'
                    : 'border-[var(--line)] bg-[var(--surface)] text-ink hover:border-brand-accent hover:shadow-xs'
                }`}
              >
                {/* Hora de la ranura */}
                <div className="text-xs font-bold text-ink">{slot.label}</div>

                {/* Contador de aforo / estado de exclusividad (TSK-FE-08) */}
                <div className="my-1.5">
                  {isDisabled ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <Lock size={11} />
                      {slot.disabledReason || 'No disponible'}
                    </span>
                  ) : isPrivatePool ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full">
                      Exclusiva
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Users size={11} />
                      <b>{slot.capacity}</b> cupos restantes
                    </span>
                  )}
                </div>

                {/* Indicador de estado */}
                <div className="w-full flex justify-center">
                  <span
                    className={`inline-block w-full py-0.5 text-[10px] font-semibold rounded-md ${
                      isDisabled
                        ? 'bg-destructive/15 text-destructive'
                        : isSelected
                        ? 'bg-brand-accent text-content-on-accent'
                        : 'bg-[var(--surface-soft)] text-subtle'
                    }`}
                  >
                    {isDisabled
                      ? isPool && poolMaintenance.blocked
                        ? 'Mantenimiento'
                        : 'Pausada'
                      : isSelected
                      ? 'Seleccionada'
                      : 'Disponible'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
