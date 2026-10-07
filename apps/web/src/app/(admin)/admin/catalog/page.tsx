'use client'

import { useState } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react'
import {
  defaultSchedules,
  formatMoney,
  generateOperatingSlots,
  makeId,
  sedes,
  serviceCategories,
  type CatalogItem,
  type GeneratedOperatingSlot,
  type OperatingScheduleConfig,
} from '@sportcomplex/core'
import { Badge, Input } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'
import { ConfirmDialog, Modal } from '@/components/modal'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { useCatalog } from '@/lib/stores'
import { SlotCapacityEditor } from '@/components/admin/slot-capacity-editor'

const blank: CatalogItem = {
  id: '',
  category: 'canchas',
  name: '',
  description: '',
  price: 0,
  sede: 'Poblado',
  capacity: 1,
  status: 'Disponible',
}

function CatalogForm({
  initial,
  onSave,
  onClose,
}: {
  initial: CatalogItem
  onSave: (item: CatalogItem) => void
  onClose: () => void
}) {
  const [form, setForm] = useState(initial)
  const set = <K extends keyof CatalogItem>(key: K, value: CatalogItem[K]) =>
    setForm({ ...form, [key]: value })

  return (
    <Modal
      title={initial.id ? 'Editar servicio' : 'Agregar al catálogo'}
      description="Este espacio aparecerá en el catálogo que ven los clientes."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSave({ ...form, name: form.name.trim(), description: form.description.trim() })
        }}
      >
        <label className="demo-field">
          Nombre
          <Input
            required
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
            placeholder="Ej. Cancha de pádel · Cancha 2"
          />
        </label>
        <label className="demo-field">
          Categoría
          <select
            value={form.category}
            onChange={(event) => set('category', event.target.value as CatalogItem['category'])}
          >
            {serviceCategories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="demo-field">
          Descripción
          <Input
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Breve descripción del espacio"
          />
        </label>
        <div className="form-row">
          <label className="demo-field">
            Precio (COP)
            <Input
              required
              type="number"
              min={0}
              step={1000}
              value={form.price}
              onChange={(event) => set('price', Number(event.target.value))}
            />
          </label>
          <label className="demo-field">
            Aforo / Capacidad
            <Input
              required
              type="number"
              min={1}
              value={form.capacity}
              onChange={(event) => set('capacity', Number(event.target.value))}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="demo-field">
            Sede
            <select value={form.sede} onChange={(event) => set('sede', event.target.value)}>
              {sedes.map((sede) => (
                <option key={sede} value={sede}>
                  {sede}
                </option>
              ))}
            </select>
          </label>
          <label className="demo-field">
            Disponibilidad
            <select
              value={form.status}
              onChange={(event) => set('status', event.target.value as CatalogItem['status'])}
            >
              <option value="Disponible">Disponible</option>
              <option value="Mantenimiento">Mantenimiento</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <ActionButton secondary onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit">{initial.id ? 'Guardar cambios' : 'Agregar'}</ActionButton>
        </div>
      </form>
    </Modal>
  )
}

export default function AdminCatalogPage() {
  const { notify } = useApp()
  const [catalog, setCatalog] = useCatalog()

  // Estado para programaciones operativas y aforos (TSK-FE-05 / RF-04)
  const [schedules, setSchedules] = useState<Record<string, OperatingScheduleConfig>>(() => {
    const initialMap: Record<string, OperatingScheduleConfig> = {}
    catalog.forEach((item) => {
      const existing = defaultSchedules[item.id]
      if (existing) {
        initialMap[item.id] = { ...existing }
      } else {
        const isShared =
          item.category === 'gimnasio' ||
          item.category === 'piscinas' ||
          item.category === 'zona-humeda'
        initialMap[item.id] = {
          serviceId: item.id,
          serviceName: item.name,
          categorySlug: item.category,
          capacity: item.capacity > 0 ? item.capacity : isShared ? 25 : 4,
          isShared,
          startHour: 6,
          endHour: 22,
          slotDurationMinutes: 60,
          disabledSlots: [],
        }
      }
    })
    return initialMap
  })

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    catalog[0]?.id ?? 'gimnasio-sesion-individual'
  )
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [editingSchedule, setEditingSchedule] = useState<CatalogItem | null>(null)
  const [deleting, setDeleting] = useState<CatalogItem | null>(null)
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0)

  const selectedService =
    catalog.find((item) => item.id === selectedServiceId) ?? catalog[0]
  const selectedConfig: OperatingScheduleConfig = selectedService
    ? schedules[selectedService.id] ?? {
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        categorySlug: selectedService.category,
        capacity: selectedService.capacity > 0 ? selectedService.capacity : 25,
        isShared: selectedService.category === 'gimnasio' || selectedService.category === 'piscinas',
        startHour: 6,
        endHour: 22,
        slotDurationMinutes: 60,
        disabledSlots: [],
      }
    : {
        serviceId: 'default',
        serviceName: 'Servicio',
        categorySlug: 'canchas',
        capacity: 4,
        isShared: false,
        startHour: 6,
        endHour: 22,
        slotDurationMinutes: 60,
        disabledSlots: [],
      }

  const generatedSlots: GeneratedOperatingSlot[] = generateOperatingSlots(selectedConfig)

  // Guardar datos básicos
  const save = (item: CatalogItem) => {
    if (item.id) {
      setCatalog(catalog.map((entry) => (entry.id === item.id ? item : entry)))
      notify('Servicio actualizado.', 'success')
    } else {
      const newId = makeId(item.name)
      const newItem = { ...item, id: newId }
      setCatalog([...catalog, newItem])
      setSchedules((prev) => ({
        ...prev,
        [newId]: {
          serviceId: newId,
          serviceName: item.name,
          categorySlug: item.category,
          capacity: item.capacity > 0 ? item.capacity : 10,
          isShared: false,
          startHour: 6,
          endHour: 22,
          slotDurationMinutes: 60,
          disabledSlots: [],
        },
      }))
      notify('Servicio agregado al catálogo.', 'success')
    }
    setEditing(null)
  }

  // Guardar Aforo y Franjas Horarias (TSK-FE-05 / HU-05)
  const handleSaveSchedule = (
    updatedService: CatalogItem,
    updatedConfig: OperatingScheduleConfig
  ) => {
    setCatalog((prev) =>
      prev.map((item) => (item.id === updatedService.id ? updatedService : item))
    )
    setSchedules((prev) => ({
      ...prev,
      [updatedConfig.serviceId]: updatedConfig,
    }))
    setSelectedServiceId(updatedConfig.serviceId)
    setEditingSchedule(null)
    notify(
      `Aforo (${updatedConfig.capacity} pers.) y franjas horarias actualizados para "${updatedService.name}".`,
      'success'
    )
  }

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
    <main className="section-shell app-page demo-page">
      <PageHeading
        eyebrow="ADMINISTRACIÓN"
        title="Catálogo & Aforo"
        description="Parametriza la capacidad máxima (CHECK capacity > 0) y turnos de 60 min entre las 06:00 y las 22:00."
        action={
          <ActionButton onClick={() => setEditing(blank)}>
            <Plus size={16} /> Agregar al catálogo
          </ActionButton>
        }
      />

      {/* Tarjeta del Catálogo Principal */}
      <section className="demo-card">
        <div className="demo-card-heading">
          <div>
            <h2>Servicios del catálogo</h2>
            <p>
              {catalog.length} {catalog.length === 1 ? 'servicio' : 'servicios'} registrados.
              Haz clic en cualquier servicio para ver su calendario operativo.
            </p>
          </div>
        </div>

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>Servicio</th>
                <th>Categoría</th>
                <th>Sede</th>
                <th>Precio</th>
                <th>Aforo & Modalidad (RF-04)</th>
                <th>Disponibilidad</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {catalog.length === 0 && (
                <tr>
                  <td colSpan={7}>Aún no hay servicios. Agrega el primero.</td>
                </tr>
              )}
              {catalog.map((item) => {
                const config = schedules[item.id]
                const capacityValue = config?.capacity ?? item.capacity
                const isShared = config?.isShared ?? (item.category === 'gimnasio' || item.category === 'piscinas')
                const isSelected = selectedService?.id === item.id

                return (
                  <tr
                    key={item.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[var(--surface-soft)] font-medium' : ''
                    }`}
                    onClick={() => setSelectedServiceId(item.id)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />}
                        <span>{item.name}</span>
                      </div>
                    </td>
                    <td>
                      {serviceCategories.find((category) => category.slug === item.category)?.name}
                    </td>
                    <td>{item.sede}</td>
                    <td>{formatMoney(item.price)} COP</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={isShared ? 'success' : 'secondary'} className="text-[11px] font-semibold">
                          {isShared ? 'Compartido' : 'Exclusivo'}
                        </Badge>
                        <span className="text-xs text-subtle">
                          <b>{capacityValue}</b> {capacityValue === 1 ? 'cupo' : 'personas'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Badge variant={item.status === 'Disponible' ? 'success' : 'warning'}>
                        {item.status}
                      </Badge>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        {/* Botón especializado para editar Aforo y Franjas (TSK-FE-05) */}
                        <button
                          type="button"
                          className="action-secondary text-xs flex items-center gap-1 py-1 px-2.5 rounded-md border border-[var(--line)] hover:bg-[var(--surface-soft)] font-medium"
                          title={`Editar aforo y franjas de ${item.name}`}
                          onClick={() => setEditingSchedule(item)}
                        >
                          <SlidersHorizontal size={13} className="text-brand-accent" />
                          <span>Aforo & Franjas</span>
                        </button>

                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            const nextStatus =
                              item.status === 'Disponible' ? 'Mantenimiento' : 'Disponible'
                            setCatalog(
                              catalog.map((entry) =>
                                entry.id === item.id ? { ...entry, status: nextStatus } : entry
                              )
                            )
                            notify(
                              item.status === 'Disponible'
                                ? 'Servicio pausado.'
                                : 'Servicio activado.',
                              'success'
                            )
                          }}
                        >
                          {item.status === 'Disponible' ? 'Pausar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="icon-action"
                          aria-label={`Editar ${item.name}`}
                          onClick={() => setEditing(item)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action icon-danger"
                          aria-label={`Eliminar ${item.name}`}
                          onClick={() => setDeleting(item)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Calendario Operativo del Servicio Seleccionado (Criterio Clave de Aceptación Jira TSK-FE-05) */}
      {selectedService && (
        <section className="demo-card mt-8">
          <div className="demo-card-heading flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-brand-accent" />
                <h2>Calendario Operativo del Servicio — {selectedService.name}</h2>
              </div>
              <p>
                Criterio Clave HU-05: El calendario refleja de forma inmediata el aforo configurado (
                <b>{selectedConfig.capacity} personas</b>) y las ranuras operativas de 60 min (06:00 a 22:00).
              </p>
            </div>
            <ActionButton
              secondary
              size="sm"
              onClick={() => setEditingSchedule(selectedService)}
            >
              <SlidersHorizontal size={14} /> Modificar Aforo & Franjas
            </ActionButton>
          </div>

          {/* Selector de días de la semana */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 border-b border-[var(--line)]">
            {weekDays.map((day) => (
              <button
                key={day.offset}
                type="button"
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex flex-col items-center min-w-[70px] border transition-all ${
                  selectedDayOffset === day.offset
                    ? 'border-brand-accent bg-[var(--surface-soft)] text-brand-accent shadow-sm'
                    : 'border-[var(--line)] text-subtle hover:text-ink'
                }`}
                onClick={() => setSelectedDayOffset(day.offset)}
              >
                <span className="uppercase text-[10px] tracking-wider">{day.name}</span>
                <span className="font-bold text-sm">{day.dateStr}</span>
                {day.isToday && (
                  <span className="text-[9px] text-brand-accent font-medium mt-0.5">Hoy</span>
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
      )}

      {/* Modal de Edición Básica */}
      {editing && (
        <CatalogForm initial={editing} onSave={save} onClose={() => setEditing(null)} />
      )}

      {/* Modal Especializado de Aforo y Franjas Horarias (TSK-FE-05) */}
      {editingSchedule && (
        <SlotCapacityEditor
          service={editingSchedule}
          initialConfig={schedules[editingSchedule.id]}
          onSave={handleSaveSchedule}
          onClose={() => setEditingSchedule(null)}
        />
      )}

      {/* Diálogo de Confirmación para Eliminar */}
      {deleting && (
        <ConfirmDialog
          title="Eliminar servicio"
          message={`¿Eliminar «${deleting.name}» del catálogo? Dejará de mostrarse a los clientes.`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            setCatalog(catalog.filter((entry) => entry.id !== deleting.id))
            setDeleting(null)
            notify('Servicio eliminado.', 'success')
          }}
        />
      )}
    </main>
  )
}
