'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Minus,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react'
import {
  generateOperatingSlots,
  validateServiceCapacity,
  type CatalogItem,
  type GeneratedOperatingSlot,
  type OperatingScheduleConfig,
} from '@sportcomplex/core'
import { Badge, Button, Card } from '@sportcomplex/ui'

interface SlotCapacityEditorProps {
  service: CatalogItem
  initialConfig?: OperatingScheduleConfig
  onSave: (updatedService: CatalogItem, updatedConfig: OperatingScheduleConfig) => Promise<void> | void
  onClose: () => void
}

export function SlotCapacityEditor({
  service,
  initialConfig,
  onSave,
  onClose,
}: SlotCapacityEditorProps) {
  const defaultConfig: OperatingScheduleConfig = initialConfig ?? {
    serviceId: service.id,
    serviceName: service.name,
    categorySlug: service.category,
    capacity: service.capacity > 0 ? service.capacity : 25,
    isShared: service.category === 'gimnasio' || service.category === 'piscinas' || service.category === 'zona-humeda',
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots: [],
  }

  const [capacity, setCapacity] = useState<number>(defaultConfig.capacity)
  const [isShared, setIsShared] = useState<boolean>(defaultConfig.isShared)
  const [startHour, setStartHour] = useState<number>(defaultConfig.startHour)
  const [endHour, setEndHour] = useState<number>(defaultConfig.endHour)
  const [disabledSlots, setDisabledSlots] = useState<string[]>(defaultConfig.disabledSlots)
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor')
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Validación de negocio: CHECK capacity > 0 (RF-04)
  const capacityValidation = validateServiceCapacity(capacity)
  const isCapacityValid = capacityValidation.valid

  // Configuración actual en tiempo real
  const currentConfig: OperatingScheduleConfig = {
    serviceId: service.id,
    serviceName: service.name,
    categorySlug: service.category,
    capacity: isCapacityValid ? capacity : 1,
    isShared,
    startHour,
    endHour,
    slotDurationMinutes: 60,
    disabledSlots,
  }

  // Generación pura de ranuras en tiempo real
  const generatedSlots: GeneratedOperatingSlot[] = generateOperatingSlots(currentConfig)
  const totalSlotsCount = generatedSlots.length
  const activeSlotsCount = generatedSlots.filter((slot) => slot.isAvailable).length
  const disabledSlotsCount = totalSlotsCount - activeSlotsCount

  const handleToggleSlot = (time: string) => {
    setSaveError(null)
    setDisabledSlots((prev) =>
      prev.includes(time) ? prev.filter((item) => item !== time) : [...prev, time]
    )
  }

  const handleToggleAllSlots = (enableAll: boolean) => {
    setSaveError(null)
    if (enableAll) {
      setDisabledSlots([])
    } else {
      setDisabledSlots(generatedSlots.map((slot) => slot.time))
    }
  }

  const handleCapacityChange = (delta: number) => {
    setSaveError(null)
    const next = Math.max(1, capacity + delta)
    setCapacity(next)
  }

  const handleSave = async () => {
    if (!isCapacityValid || isSaving) return
    setSaveError(null)
    setIsSaving(true)

    try {
      const updatedService: CatalogItem = {
        ...service,
        capacity,
      }

      await onSave(updatedService, currentConfig)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al persistir los parámetros de aforo y franjas en el servidor.'
      setSaveError(message)
    } finally {
      setIsSaving(false)
    }
  }

  // Días de previsualización para el calendario semanal
  const daysOfWeek = ['Hoy', 'Mañana', '+2 Días', '+3 Días', '+4 Días', '+5 Días', '+6 Días']

  return (
    <div className="slot-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="slot-editor-title">
      <div className="slot-editor-shell">
        {/* Cabecera del Editor */}
        <header className="slot-editor-header">
          <div className="flex items-center gap-3">
            <div className="slot-editor-icon-chip">
              <Layers size={20} className="text-brand-lime" />
            </div>
            <div>
              <div className="eyebrow">RF-04 · GESTIÓN DE AFORO Y FRANJAS</div>
              <h2 id="slot-editor-title" className="text-xl font-bold tracking-tight text-app">
                Parametrizar Aforo & Horarios: <span className="text-brand-accent">{service.name}</span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="slot-close-btn"
            aria-label="Cerrar editor"
          >
            <X size={18} />
          </button>
        </header>

        {/* Barra de Pestañas */}
        <div className="slot-editor-tabs">
          <button
            type="button"
            className={`slot-tab-btn ${activeTab === 'editor' ? 'slot-tab-active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            <Zap size={14} /> Editor de Aforo & Franjas
          </button>
          <button
            type="button"
            className={`slot-tab-btn ${activeTab === 'preview' ? 'slot-tab-active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Calendar size={14} /> Previsualización en Calendario
          </button>
        </div>

        {/* Cuerpo del Editor */}
        <div className="slot-editor-body">
          {activeTab === 'editor' ? (
            <div className="slot-editor-grid">
              {/* Columna Izquierda: Parámetros de Aforo y Horarios */}
              <div className="slot-config-pane">
                {/* Bloque 1: Aforo Máximo */}
                <Card className="slot-control-card">
                  <div className="control-card-header">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-brand-accent" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-app">
                        Aforo Máximo del Servicio
                      </h3>
                    </div>
                    <Badge variant={isShared ? 'success' : 'outline'}>
                      {isShared ? 'Servicio Compartido' : 'Uso Exclusivo'}
                    </Badge>
                  </div>

                  <p className="text-xs text-subtle mb-4">
                    Establece el número máximo de personas permitidas simultáneamente en cada franja horaria.
                    Garantiza la restricción de base de datos <code className="font-mono text-brand-accent">CHECK (capacity &gt; 0)</code>.
                  </p>

                  <div className="capacity-input-row">
                    <div className="capacity-stepper">
                      <button
                        type="button"
                        onClick={() => handleCapacityChange(-1)}
                        className="stepper-btn"
                        aria-label="Disminuir capacidad"
                        disabled={capacity <= 1}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={capacity}
                        onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                        className="capacity-number-input"
                        aria-label="Capacidad máxima"
                      />
                      <button
                        type="button"
                        onClick={() => handleCapacityChange(1)}
                        className="stepper-btn"
                        aria-label="Aumentar capacidad"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="capacity-meta-box">
                      <span className="text-xs font-bold text-app">Cupos por franja</span>
                      <small className="text-[11px] text-subtle">
                        {isShared ? 'Aforo concurrente por persona' : 'Cancha completa (máx. jugadores)'}
                      </small>
                    </div>
                  </div>

                  {/* Alerta de validación si es menor o igual a 0 */}
                  {!isCapacityValid && (
                    <div className="slot-validation-alert">
                      <AlertCircle size={15} />
                      <span>{capacityValidation.error}</span>
                    </div>
                  )}

                  {/* Selector de Modalidad */}
                  <div className="mt-4 pt-3 border-t border-[var(--line)]">
                    <label className="text-xs font-bold text-app block mb-2">Modalidad de Cupo</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsShared(true)}
                        className={`modality-pill ${isShared ? 'modality-pill-active' : ''}`}
                      >
                        <Users size={14} />
                        <div>
                          <strong>Compartido</strong>
                          <small>Emite hasta {capacity} cupos individuales</small>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsShared(false)}
                        className={`modality-pill ${!isShared ? 'modality-pill-active' : ''}`}
                      >
                        <ShieldCheck size={14} />
                        <div>
                          <strong>Exclusivo</strong>
                          <small>1 reserva bloquea la pista completa</small>
                        </div>
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Bloque 2: Rango Horario de Operación (06:00 a 22:00) */}
                <Card className="slot-control-card">
                  <div className="control-card-header">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-brand-accent" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-app">
                        Horario de Operación (Turnos de 60 min)
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-brand-lime">60 min / turno</span>
                  </div>

                  <p className="text-xs text-subtle mb-4">
                    Define la ventana diaria entre las 06:00 y las 22:00. El motor generará ranuras horarias automáticas.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-subtle block mb-1">Hora Inicio</label>
                      <select
                        value={startHour}
                        onChange={(e) => setStartHour(Number(e.target.value))}
                        className="slot-select-field"
                      >
                        {[5, 6, 7, 8, 9, 10].map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-subtle block mb-1">Hora Cierre</label>
                      <select
                        value={endHour}
                        onChange={(e) => setEndHour(Number(e.target.value))}
                        className="slot-select-field"
                      >
                        {[20, 21, 22, 23].map((h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, '0')}:00 PM
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Botones de acción masiva */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--line)]">
                    <button
                      type="button"
                      onClick={() => handleToggleAllSlots(true)}
                      className="text-xs text-link flex items-center gap-1 font-semibold"
                    >
                      <Check size={13} /> Activar todas las franjas
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAllSlots(false)}
                      className="text-xs text-subtle hover:text-app flex items-center gap-1 font-semibold"
                    >
                      <RotateCcw size={13} /> Pausar todas
                    </button>
                  </div>
                </Card>
              </div>

              {/* Columna Derecha: Previsualizador en Vivo de Ranuras (Slot Preview Grid) */}
              <div className="slot-preview-pane">
                <div className="preview-pane-header">
                  <div>
                    <h3 className="text-base font-bold text-app flex items-center gap-2">
                      <Sparkles size={16} className="text-brand-lime" />
                      Previsualización de Ranuras Horarias
                    </h3>
                    <p className="text-xs text-subtle mt-0.5">
                      Haz clic en cualquier ranura para habilitarla o pausarla individualmente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="slot-stat-chip">
                      <strong>{activeSlotsCount}</strong> activas
                    </span>
                    {disabledSlotsCount > 0 && (
                      <span className="slot-stat-chip text-amber-500">
                        <strong>{disabledSlotsCount}</strong> pausadas
                      </span>
                    )}
                  </div>
                </div>

                {/* Grid de Ranuras Generadas */}
                <div className="slot-grid-matrix">
                  {generatedSlots.map((slot) => {
                    const isActive = slot.isAvailable
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => handleToggleSlot(slot.time)}
                        className={`slot-item-card ${isActive ? 'slot-item-active' : 'slot-item-disabled'}`}
                        aria-pressed={isActive}
                      >
                        <div className="slot-card-top">
                          <span className="slot-card-time">{slot.label}</span>
                          <span className="slot-status-dot" />
                        </div>
                        <div className="slot-card-bottom">
                          <span className="slot-card-cap">
                            <Users size={12} />
                            {slot.capacity} {isShared ? 'cupos' : 'personas'}
                          </span>
                          <span className="slot-action-label">
                            {isActive ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Resumen de Impacto Técnico */}
                <div className="slot-impact-summary">
                  <div className="flex items-start gap-3">
                    <div className="impact-icon-box">
                      <CheckCircle2 size={18} className="text-brand-lime" />
                    </div>
                    <div className="text-xs">
                      <b className="text-app block mb-0.5">Garantía de Aforo y No-Overbooking (RF-04):</b>
                      <span className="text-subtle">
                        {isShared
                          ? `En cada franja horaria activa se permitirán exactamente hasta ${capacity} reservas concurrentes simultáneas. El sistema impedirá emitir cupos adicionales.`
                          : `Al ser un servicio de uso exclusivo, 1 reserva bloquea la franja de 60 minutos con aforo permitido de hasta ${capacity} asistentes.`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Pestaña: Previsualización de Calendario del Servicio */
            <div className="calendar-preview-pane">
              <div className="calendar-preview-intro mb-4">
                <h3 className="text-base font-bold text-app">
                  Calendario Operativo Proyectado: {service.name}
                </h3>
                <p className="text-xs text-subtle">
                  Así verán los socios y clientes los turnos disponibles en el portal de reservas tras aplicar estos parámetros.
                </p>
              </div>

              {/* Selector de días */}
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
                {daysOfWeek.map((dayLabel, idx) => (
                  <button
                    key={dayLabel}
                    type="button"
                    onClick={() => setSelectedDayOffset(idx)}
                    className={`day-selector-pill ${selectedDayOffset === idx ? 'day-pill-active' : ''}`}
                  >
                    <span>{dayLabel}</span>
                    <small>+{idx} d</small>
                  </button>
                ))}
              </div>

              {/* Grilla de turnos proyectada */}
              <div className="projected-slots-grid">
                {generatedSlots.map((slot) => (
                  <div
                    key={slot.time}
                    className={`projected-slot-card ${slot.isAvailable ? 'slot-open' : 'slot-closed'}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <b className="text-sm font-semibold">{slot.label}</b>
                      <span className="text-[11px] font-bold">
                        {slot.isAvailable ? 'Disponible' : 'No disponible'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-subtle">
                      <span>{slot.isAvailable ? `${slot.capacity} cupos max.` : 'Mantenimiento'}</span>
                      <span className="text-brand-accent font-bold">${service.price.toLocaleString()} COP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie del Editor con Acciones */}
        <footer className="slot-editor-footer flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-subtle">
            {saveError ? (
              <div className="flex items-center gap-1.5 text-red-500 font-semibold">
                <AlertCircle size={15} />
                <span>{saveError}</span>
              </div>
            ) : isCapacityValid ? (
              <span>✓ Parámetros listos para guardar ({activeSlotsCount} franjas operativas activas)</span>
            ) : (
              <span className="text-red-500 font-bold">Corrige la capacidad para poder guardar</span>
            )}
          </div>
          <div className="flex items-center gap-3 justify-end">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={handleSave}
              disabled={!isCapacityValid || isSaving}
              className="action-button"
            >
              <Save size={16} /> {isSaving ? 'Guardando en BD...' : 'Guardar Parámetros de Aforo y Franjas'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
