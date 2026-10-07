'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react'
import {
  formatMoney,
  getBogotaTodayISO,
  serviceCategories,
  type CatalogItem,
  type GeneratedOperatingSlot,
} from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { useCatalog } from '@/lib/stores'
import { AvailabilityCalendar } from '@/components/booking/availability-calendar'

export default function CustomerBookPage() {
  const { notify } = useApp()
  const [catalog] = useCatalog()

  // Filtros de categoría y servicio seleccionado
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    catalog.find((i) => i.category === 'piscinas')?.id ?? catalog[0]?.id ?? ''
  )

  // Estado del calendario y selección
  const todayISO = useMemo(() => getBogotaTodayISO(), [])
  const [selectedDate, setSelectedDate] = useState<string>(todayISO)
  const [selectedSlot, setSelectedSlot] = useState<GeneratedOperatingSlot | null>(null)
  const [attendees, setAttendees] = useState<number>(1)

  // Lista filtrada de servicios disponibles
  const availableServices = catalog.filter((item) => item.status === 'Disponible')
  const filteredServices = availableServices.filter(
    (item) => selectedCategory === 'todas' || item.category === selectedCategory
  )

  const selectedService: CatalogItem =
    catalog.find((i) => i.id === selectedServiceId) ??
    filteredServices[0] ??
    catalog[0]

  const isPool = selectedService?.category === 'piscinas'
  const isPrivatePool =
    isPool && (selectedService.poolType === 'PRIVADA' || selectedService.capacity === 1)
  const maxAttendees = Math.max(1, selectedService?.capacity ?? 1)
  const effectiveAttendees = isPrivatePool ? 1 : attendees
  const totalPrice = (selectedService?.price ?? 0) * effectiveAttendees

  const handleSelectDate = (dateISO: string) => {
    setSelectedDate(dateISO)
    setSelectedSlot(null) // Reset slot al cambiar de fecha
  }

  const handleSelectSlot = (slot: GeneratedOperatingSlot) => {
    setSelectedSlot(slot)
    notify(`Franja ${slot.label} seleccionada para el ${selectedDate}.`, 'success')
  }

  return (
    <main className="section-shell app-page demo-page">
      <div className="mb-4">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs text-subtle hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft size={14} /> Volver a mi portal
        </Link>
      </div>

      <PageHeading
        eyebrow="RESERVAS Y DISPONIBILIDAD"
        title="Reservar Instalaciones Deportivas"
        description="Consulta disponibilidad en tiempo real con ventana de 15 días, reglas de mantenimiento preventivo y control de aforo (RF-05, RF-06, RF-07)."
      />

      {/* Selector de Categorías (Pestañas) */}
      <section className="demo-card mb-6 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              className={`py-1.5 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedCategory === 'todas'
                  ? 'bg-brand-accent text-content-on-accent border-brand-accent shadow-xs'
                  : 'bg-[var(--surface)] text-subtle border-[var(--line)] hover:text-ink'
              }`}
              onClick={() => setSelectedCategory('todas')}
            >
              Todas ({availableServices.length})
            </button>
            {serviceCategories.map((cat) => {
              const count = availableServices.filter((c) => c.category === cat.slug).length
              return (
                <button
                  key={cat.slug}
                  type="button"
                  className={`py-1.5 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedCategory === cat.slug
                      ? 'bg-brand-accent text-content-on-accent border-brand-accent shadow-xs'
                      : 'bg-[var(--surface)] text-subtle border-[var(--line)] hover:text-ink'
                  }`}
                  onClick={() => setSelectedCategory(cat.slug)}
                >
                  {cat.name} ({count})
                </button>
              )
            })}
          </div>

          <span className="text-xs text-subtle font-medium whitespace-nowrap">
            {filteredServices.length} servicios disponibles
          </span>
        </div>
      </section>

      {/* Disposición en 2 columnas: Lista de Servicios + Calendario */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Selección de Servicio */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink uppercase tracking-wider px-1">
            1. Elige una Instalación
          </h2>

          <div className="flex flex-col gap-2.5 max-h-[620px] overflow-y-auto pr-1">
            {filteredServices.map((item) => {
              const isSelected = selectedService?.id === item.id
              const itemIsPool = item.category === 'piscinas'
              const itemIsPrivate = itemIsPool && item.poolType === 'PRIVADA'

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(item.id)
                    setSelectedSlot(null)
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all relative ${
                    isSelected
                      ? 'border-brand-accent bg-[var(--surface-soft)] shadow-sm ring-1 ring-brand-accent'
                      : 'border-[var(--line)] bg-[var(--surface)] hover:border-brand-accent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-sm text-ink leading-snug">
                      {item.name}
                    </span>
                    <Badge
                      variant={isSelected ? 'success' : 'outline'}
                      className="text-[10px] uppercase font-bold shrink-0"
                    >
                      {item.category}
                    </Badge>
                  </div>

                  <p className="text-xs text-subtle mt-1 line-clamp-2">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[var(--line)] text-xs">
                    <span className="text-subtle flex items-center gap-1">
                      <MapPin size={12} /> {item.sede}
                    </span>

                    {/* Badge de Modalidad de Piscina (TSK-FE-08) */}
                    {itemIsPool ? (
                      <Badge
                        variant={itemIsPrivate ? 'secondary' : 'success'}
                        className="text-[10px]"
                      >
                        {itemIsPrivate ? 'Exclusiva' : `${item.capacity} cupos max`}
                      </Badge>
                    ) : (
                      <span className="text-subtle font-medium">
                        Cap. {item.capacity} pers.
                      </span>
                    )}

                    <span className="font-bold text-ink">
                      {formatMoney(item.price)} COP
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Columna Derecha: Calendario y Resumen de Reserva */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="demo-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-[var(--line)]">
              <div>
                <span className="text-xs uppercase font-bold text-brand-accent tracking-wider">
                  2. Disponibilidad de Franjas
                </span>
                <h2 className="text-xl font-extrabold text-ink mt-0.5">
                  {selectedService?.name}
                </h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-subtle">
                  <span className="flex items-center gap-1">
                    <MapPin size={12} /> Sede {selectedService?.sede}
                  </span>
                  <span>·</span>
                  <span>Tarifa base: <b>{formatMoney(selectedService?.price ?? 0)} COP</b></span>
                  {isPool && (
                    <>
                      <span>·</span>
                      <Badge variant={isPrivatePool ? 'secondary' : 'success'} className="text-[10px]">
                        {isPrivatePool ? 'Alquiler Privado' : 'Aforo Concurrente'}
                      </Badge>
                    </>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-subtle block">Horario Complejo</span>
                <span className="text-xs font-bold text-ink">06:00 a 22:00 (Turnos 60 min)</span>
              </div>
            </div>

            {/* Componente Unificado de Calendario (TSK-FE-06, 07, 08) */}
            {selectedService && (
              <AvailabilityCalendar
                service={selectedService}
                selectedDate={selectedDate}
                selectedSlotTime={selectedSlot?.time ?? ''}
                onSelectDate={handleSelectDate}
                onSelectSlot={handleSelectSlot}
              />
            )}
          </div>

          {/* Resumen de Reserva y Acción */}
          <div className="demo-card p-5 bg-[var(--surface-soft)] border-brand-accent/40">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <ShieldCheck className="w-4 h-4 text-brand-accent" />
                  <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                    Resumen de Selección
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-subtle block">Fecha elegida</span>
                    <span className="font-bold text-ink">
                      {selectedDate || 'Sin seleccionar'}
                    </span>
                  </div>

                  <div>
                    <span className="text-subtle block">Horario</span>
                    <span className="font-bold text-ink">
                      {selectedSlot ? selectedSlot.label : 'Elige una franja arriba'}
                    </span>
                  </div>

                  <div>
                    <span className="text-subtle block">Modalidad</span>
                    <span className="font-bold text-ink">
                      {isPool
                        ? isPrivatePool
                          ? 'Privada (Exclusiva)'
                          : 'Pública (Aforo)'
                        : 'Estándar'}
                    </span>
                  </div>
                </div>

                {/* Selector de asistentes para piscinas públicas o servicios compartidos */}
                {!isPrivatePool && maxAttendees > 1 && (
                  <div className="mt-3 flex items-center gap-3 pt-3 border-t border-[var(--line)]">
                    <label className="flex items-center gap-2 text-xs font-medium text-ink">
                      <Users size={14} className="text-brand-accent" />
                      Cantidad de personas / cupos:
                      <select
                        aria-label="Cantidad de personas"
                        value={attendees}
                        onChange={(e) => setAttendees(Number(e.target.value))}
                        className="py-1 px-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-bold"
                      >
                        {Array.from({ length: Math.min(10, maxAttendees) }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n} {n === 1 ? 'persona' : 'personas'}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <span className="text-[11px] text-subtle">
                      (Aforo máx. permitido: {maxAttendees})
                    </span>
                  </div>
                )}
              </div>

              {/* Botón de checkout y precio total */}
              <div className="flex flex-col sm:flex-row md:flex-col items-end justify-center gap-2 border-t md:border-t-0 md:border-l border-[var(--line)] pt-3 md:pt-0 md:pl-5">
                <div className="text-right">
                  <span className="text-[11px] text-subtle block">Total a pagar</span>
                  <span className="text-xl font-extrabold text-ink">
                    {formatMoney(totalPrice)} <small className="text-xs font-semibold">COP</small>
                  </span>
                </div>

                <ActionButton
                  disabled={!selectedSlot || !selectedSlot.isAvailable}
                  onClick={() => {
                    if (!selectedSlot) return
                    notify(
                      `Reserva preparada para ${selectedService.name} el ${selectedDate} a las ${selectedSlot.time}.`,
                      'success'
                    )
                  }}
                  className="w-full sm:w-auto"
                >
                  {selectedSlot ? 'Continuar a Checkout' : 'Selecciona un Horario'}{' '}
                  <ArrowRight size={15} />
                </ActionButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
