'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  MapPin,
  Pencil,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  defaultSchedules,
  generateOperatingSlots,
  initialCatalog,
  serviceCategories,
  type CatalogItem,
  type OperatingScheduleConfig,
} from '@sportcomplex/core'
import { Badge, Button, Card, Input } from '@sportcomplex/ui'
import { SlotCapacityEditor } from '@/components/admin/slot-capacity-editor'

export default function AdminServicesPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>(initialCatalog)
  const [schedules, setSchedules] = useState<Record<string, OperatingScheduleConfig>>(defaultSchedules)
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [editingService, setEditingService] = useState<CatalogItem | null>(null)
  const [viewingCalendarService, setViewingCalendarService] = useState<CatalogItem>(initialCatalog[0])
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Filtrado de servicios
  const filteredCatalog = catalog.filter((item) => {
    const matchesCategory = selectedCategory === 'todas' || item.category === selectedCategory
    const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sede.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesQuery
  })

  // Métricas agregadas
  const totalServices = catalog.length
  const sharedServicesCount = catalog.filter((item) => {
    const sched = schedules[item.id]
    return sched ? sched.isShared : item.category === 'gimnasio' || item.category === 'piscinas'
  }).length
  const totalCapacitySum = catalog.reduce((acc, curr) => acc + curr.capacity, 0)
  const activeSchedulesCount = Object.keys(schedules).length

  const handleSaveSchedule = (updatedService: CatalogItem, updatedConfig: OperatingScheduleConfig) => {
    // 1. Actualizar catálogo con el nuevo aforo
    setCatalog((prev) =>
      prev.map((item) => (item.id === updatedService.id ? updatedService : item))
    )

    // 2. Actualizar configuración de franjas horarias
    setSchedules((prev) => ({
      ...prev,
      [updatedService.id]: updatedConfig,
    }))

    // 3. Sincronizar la vista activa del calendario
    setViewingCalendarService(updatedService)

    // 4. Cerrar editor y mostrar confirmación
    setEditingService(null)
    showToast(`✓ Parámetros guardados: ${updatedService.name} ahora tiene aforo de ${updatedService.capacity} cupos.`)
  }

  // Ranuras del servicio que se está inspeccionando en el calendario
  const currentViewingSchedule = schedules[viewingCalendarService.id] ?? {
    serviceId: viewingCalendarService.id,
    serviceName: viewingCalendarService.name,
    categorySlug: viewingCalendarService.category,
    capacity: viewingCalendarService.capacity,
    isShared: viewingCalendarService.category === 'gimnasio' || viewingCalendarService.category === 'piscinas',
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  }
  const calendarSlots = generateOperatingSlots(currentViewingSchedule)

  return (
    <div className="admin-services-page section-shell py-8">
      {/* Toast flotante de confirmación */}
      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          <CheckCircle2 size={18} className="text-brand-lime" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabecera de Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow flex items-center gap-2 mb-1">
            <Link href="/" className="hover:underline flex items-center gap-1 text-subtle">
              <ArrowLeft size={13} /> Inicio
            </Link>
            <span>/</span>
            <span>ADMINISTRACIÓN</span>
            <span>/</span>
            <span className="text-brand-accent">RF-04 AFORO Y FRANJAS</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-app">
            Catálogo de Servicios & Parametrización de Aforo
          </h1>
          <p className="text-sm text-subtle mt-1 max-w-2xl">
            Control de aforo máximo concurrente (<code className="font-mono text-brand-accent">CHECK capacity &gt; 0</code>),
            editor de turnos operativos de 60 min (06:00 a 22:00) y calendario de ranuras independientes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="default"
            className="action-button"
            onClick={() => {
              // Abre el editor para el servicio que está en vista de calendario
              setEditingService(viewingCalendarService)
            }}
          >
            <Pencil size={15} /> Editar Aforo del Servicio Actual
          </Button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Aforo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 bg-[var(--surface-card)]">
          <div className="flex items-center justify-between text-subtle text-xs font-semibold mb-1">
            <span>Total Servicios</span>
            <Layers size={15} />
          </div>
          <b className="text-2xl font-black text-app">{totalServices}</b>
          <small className="text-[11px] text-subtle block mt-1">Instancias activas en el complejo</small>
        </Card>

        <Card className="p-4 bg-[var(--surface-card)]">
          <div className="flex items-center justify-between text-subtle text-xs font-semibold mb-1">
            <span>Servicios Compartidos</span>
            <Users size={15} className="text-brand-accent" />
          </div>
          <b className="text-2xl font-black text-brand-accent">{sharedServicesCount}</b>
          <small className="text-[11px] text-subtle block mt-1">Con aforo por cupos (Gimnasio, Piscinas)</small>
        </Card>

        <Card className="p-4 bg-[var(--surface-card)]">
          <div className="flex items-center justify-between text-subtle text-xs font-semibold mb-1">
            <span>Aforo Simultáneo Total</span>
            <Sparkles size={15} className="text-brand-lime" />
          </div>
          <b className="text-2xl font-black text-app">{totalCapacitySum}</b>
          <small className="text-[11px] text-subtle block mt-1">Personas máximas concurrentes</small>
        </Card>

        <Card className="p-4 bg-[var(--surface-card)]">
          <div className="flex items-center justify-between text-subtle text-xs font-semibold mb-1">
            <span>Ventana Operativa</span>
            <Clock size={15} />
          </div>
          <b className="text-2xl font-black text-app">06:00 – 22:00</b>
          <small className="text-[11px] text-subtle block mt-1">Turnos fijos de 60 minutos</small>
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          <button
            type="button"
            className={`admin-filter-pill ${selectedCategory === 'todas' ? 'admin-filter-active' : ''}`}
            onClick={() => setSelectedCategory('todas')}
          >
            Todas las categorías
          </button>
          {serviceCategories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              className={`admin-filter-pill ${selectedCategory === cat.slug ? 'admin-filter-active' : ''}`}
              onClick={() => setSelectedCategory(cat.slug)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input
            placeholder="Buscar por servicio o sede..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Tabla de Servicios y Aforos (Alta Densidad RNF-04) */}
      <Card className="mb-10 overflow-hidden border border-[var(--line)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-soft)] text-subtle text-[11px] uppercase tracking-wider font-bold">
                <th className="py-3 px-4">Servicio / Instancia</th>
                <th className="py-3 px-4">Categoría & Sede</th>
                <th className="py-3 px-4">Modalidad</th>
                <th className="py-3 px-4 text-center">Aforo Máximo</th>
                <th className="py-3 px-4">Horario Operativo</th>
                <th className="py-3 px-4 text-center">Franjas Activas</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)] text-xs">
              {filteredCatalog.map((service) => {
                const sched = schedules[service.id] ?? {
                  serviceId: service.id,
                  serviceName: service.name,
                  categorySlug: service.category,
                  capacity: service.capacity,
                  isShared: service.category === 'gimnasio' || service.category === 'piscinas',
                  startHour: 6,
                  endHour: 22,
                  slotDurationMinutes: 60,
                  disabledSlots: [],
                }
                const slots = generateOperatingSlots(sched)
                const activeCount = slots.filter((s) => s.isAvailable).length
                const isSelected = viewingCalendarService.id === service.id

                return (
                  <tr
                    key={service.id}
                    className={`hover:bg-[var(--surface-soft)] transition-colors ${
                      isSelected ? 'bg-color-mix(in srgb, var(--brand-accent) 6%, transparent)' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-bold text-app">{service.name}</div>
                      <small className="text-subtle text-[11px]">{service.description}</small>
                    </td>
                    <td className="py-3 px-4">
                      <div className="capitalize font-semibold text-app">{service.category}</div>
                      <div className="flex items-center gap-1 text-subtle text-[11px]">
                        <MapPin size={11} /> Sede {service.sede}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={sched.isShared ? 'success' : 'outline'}>
                        {sched.isShared ? 'Compartido (Cupos)' : 'Exclusivo (Cancha)'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-black text-sm text-app px-2 py-0.5 rounded bg-[var(--surface-soft)]">
                        {service.capacity}
                      </span>
                      <small className="block text-[10px] text-subtle mt-0.5">
                        {sched.isShared ? 'cupos simultáneos' : 'asistentes máx.'}
                      </small>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-app">
                        {String(sched.startHour).padStart(2, '0')}:00 – {String(sched.endHour).padStart(2, '0')}:00
                      </div>
                      <small className="text-subtle text-[11px]">Turnos de 60 min</small>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-brand-lime">
                        {activeCount} / {slots.length}
                      </span>
                      <small className="block text-[10px] text-subtle">
                        {slots.length - activeCount > 0 ? `${slots.length - activeCount} pausadas` : '100% operativas'}
                      </small>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setViewingCalendarService(service)}
                        >
                          <Calendar size={13} className="mr-1" /> Ver Calendario
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs font-bold"
                          onClick={() => setEditingService(service)}
                        >
                          <Pencil size={13} className="mr-1" /> Editar Aforo & Franjas
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Criterio de Aceptación Clave: Calendario en vivo del servicio tras guardar */}
      <section className="service-live-calendar-section mt-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <div className="eyebrow flex items-center gap-1.5 text-brand-lime">
              <ShieldCheck size={14} /> CRITERIO CLAVE DE ACEPTACIÓN
            </div>
            <h2 className="text-2xl font-bold text-app">
              Calendario del Servicio: <span className="text-brand-accent">{viewingCalendarService.name}</span>
            </h2>
            <p className="text-xs text-subtle mt-1">
              Refleja exactamente las ranuras horarias de 60 minutos configuradas y el aforo asignado.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-subtle">
              Aforo activo: <strong className="text-app">{viewingCalendarService.capacity} cupos</strong>
            </span>
            <Button
              variant="default"
              size="sm"
              className="action-button text-xs"
              onClick={() => setEditingService(viewingCalendarService)}
            >
              <Pencil size={13} className="mr-1" /> Modificar Parámetros
            </Button>
          </div>
        </div>

        {/* Matriz de Ranuras del Calendario */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {calendarSlots.map((slot) => {
            const isAvail = slot.isAvailable
            return (
              <div
                key={slot.time}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isAvail
                    ? 'border-[var(--line)] bg-[var(--surface-card)] hover:border-brand-accent shadow-sm'
                    : 'border-red-900/30 bg-red-950/10 opacity-60'
                }`}
              >
                <div className="text-xs font-bold text-app mb-1">{slot.label}</div>
                <div className="flex items-center justify-center gap-1 mb-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isAvail ? 'bg-brand-lime shadow-[0_0_6px_rgba(185,230,107,0.6)]' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-subtle">
                    {isAvail ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-brand-accent pt-1 border-t border-[var(--line)]">
                  {isAvail ? `${slot.capacity} cupos max.` : 'Bloqueada'}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Modal / Editor de Aforo y Franjas Horarias */}
      {editingService && (
        <SlotCapacityEditor
          service={editingService}
          initialConfig={schedules[editingService.id]}
          onSave={handleSaveSchedule}
          onClose={() => setEditingService(null)}
        />
      )}
    </div>
  )
}
