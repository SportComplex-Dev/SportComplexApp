'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, AlertCircle, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/modal'
import { ActionButton } from '@/components/action-button'
import { createTournamentSchema } from '@sportcomplex/validation'

export interface BloqueoFormItem {
  servicioId: number
  horaInicio: string
  horaFin: string
}

export interface TournamentFormData {
  id?: string
  titulo: string
  descripcion: string
  categoriaId: number
  nivel: string
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  precioInscripcion: number
  estado: 'BORRADOR' | 'INSCRIPCIONES_ABIERTAS' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO'
  bloqueos: BloqueoFormItem[]
}

export interface TournamentEditInput {
  id?: string
  titulo?: string
  descripcion?: string | null
  categoriaId?: number
  nivel?: string
  fechaInicio?: string | Date
  fechaFin?: string | Date
  cuposTotales?: number
  precioInscripcion?: number | string
  estado?: 'BORRADOR' | 'INSCRIPCIONES_ABIERTAS' | 'EN_CURSO' | 'FINALIZADO' | 'CANCELADO'
  bloqueos?: Array<{
    servicioId: number
    horaInicio?: string | Date
    horaFin?: string | Date
  }>
}

interface TournamentFormModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentToEdit?: TournamentEditInput | null
  categories: Array<{ id: number; nombre: string }>
  services: Array<{ id: number; nombre: string; categoriaId: number }>
  onSaved: (saved?: unknown) => void
  notify: (msg: string, kind?: 'success' | 'error' | 'info') => void
}

const NIVELES_SUGERIDOS = [
  'Primera Categoría (Avanzado)',
  'Segunda Categoría (Intermedio Alto)',
  'Tercera Categoría (Intermedio)',
  'Cuarta Categoría (Iniciación / Cuarta)',
  'Abierto / Open Libre',
  'Mixto Recreativo',
]

export const TIMEZONE_BOGOTA = 'America/Bogota'

/**
 * Convierte un objeto Date o ISO string a formato local 'YYYY-MM-DDTHH:mm'
 * forzando estrictamente la zona horaria legal de Colombia (America/Bogota, UTC-5).
 */
export function toDatetimeLocal(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (isNaN(d.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOGOTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

/**
 * Convierte un string de input 'YYYY-MM-DDTHH:mm' a ISO UTC preservando el huso de Colombia (UTC-5).
 */
export function parseDatetimeLocalToUtcIso(datetimeStr: string): string {
  if (!datetimeStr) return ''
  const trimmed = datetimeStr.trim()
  if (trimmed.endsWith('Z') || trimmed.includes('+') || (trimmed.includes('-') && trimmed.length > 19)) {
    return new Date(trimmed).toISOString()
  }
  const isoWithBogotaOffset = trimmed.length === 16 ? `${trimmed}:00-05:00` : `${trimmed}-05:00`
  return new Date(isoWithBogotaOffset).toISOString()
}

export function TournamentFormModal({
  isOpen,
  onClose,
  tournamentToEdit,
  categories,
  services,
  onSaved,
  notify,
}: TournamentFormModalProps) {
  const isEditing = Boolean(tournamentToEdit?.id)

  const [formData, setFormData] = useState<TournamentFormData>({
    titulo: '',
    descripcion: '',
    categoriaId: categories[0]?.id ?? 1,
    nivel: NIVELES_SUGERIDOS[1],
    fechaInicio: '',
    fechaFin: '',
    cuposTotales: 16,
    precioInscripcion: 0,
    estado: 'BORRADOR',
    bloqueos: [],
  })

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  // BUG-01: Filtrar pistas exclusivamente por la categoría/deporte seleccionada
  const filteredServices = useMemo(() => {
    return services.filter((s) => s.categoriaId === Number(formData.categoriaId))
  }, [services, formData.categoriaId])

  useEffect(() => {
    if (tournamentToEdit) {
      setFormData({
        id: tournamentToEdit.id,
        titulo: tournamentToEdit.titulo ?? '',
        descripcion: tournamentToEdit.descripcion ?? '',
        categoriaId: tournamentToEdit.categoriaId ?? (categories[0]?.id ?? 1),
        nivel: tournamentToEdit.nivel ?? NIVELES_SUGERIDOS[1],
        fechaInicio: toDatetimeLocal(tournamentToEdit.fechaInicio),
        fechaFin: toDatetimeLocal(tournamentToEdit.fechaFin),
        cuposTotales: tournamentToEdit.cuposTotales ?? 16,
        precioInscripcion: Number(tournamentToEdit.precioInscripcion ?? 0),
        estado: tournamentToEdit.estado ?? 'BORRADOR',
        bloqueos: Array.isArray(tournamentToEdit.bloqueos)
          ? tournamentToEdit.bloqueos.map((b) => ({
              servicioId: b.servicioId,
              horaInicio: toDatetimeLocal(b.horaInicio),
              horaFin: toDatetimeLocal(b.horaFin),
            }))
          : [],
      })
    } else {
      const now = new Date()
      const nextMonth = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const finMonth = new Date(nextMonth.getTime() + 2 * 24 * 60 * 60 * 1000)

      setFormData({
        titulo: '',
        descripcion: '',
        categoriaId: categories[0]?.id ?? 1,
        nivel: NIVELES_SUGERIDOS[1],
        fechaInicio: toDatetimeLocal(nextMonth),
        fechaFin: toDatetimeLocal(finMonth),
        cuposTotales: 16,
        precioInscripcion: 0,
        estado: 'BORRADOR',
        bloqueos: [],
      })
    }
    setErrorMsg(null)
    setFieldErrors({})
  }, [tournamentToEdit, categories, isOpen])

  if (!isOpen) return null

  const handleAddBloqueo = () => {
    const defaultServiceId = filteredServices[0]?.id ?? services[0]?.id ?? 1
    setFormData((prev) => ({
      ...prev,
      bloqueos: [
        ...prev.bloqueos,
        {
          servicioId: defaultServiceId,
          horaInicio: prev.fechaInicio,
          horaFin: prev.fechaFin,
        },
      ],
    }))
  }

  const handleRemoveBloqueo = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      bloqueos: prev.bloqueos.filter((_, i) => i !== index),
    }))
  }

  const handleBloqueoChange = (
    index: number,
    field: keyof BloqueoFormItem,
    value: string | number
  ) => {
    setFormData((prev) => {
      const updated = [...prev.bloqueos]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, bloqueos: updated }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setFieldErrors({})

    if (!formData.fechaInicio || !formData.fechaFin) {
      setErrorMsg('Debes especificar las fechas y horas de inicio y fin.')
      return
    }

    const payload = {
      titulo: formData.titulo.trim(),
      descripcion: formData.descripcion.trim() || null,
      categoriaId: Number(formData.categoriaId),
      nivel: formData.nivel.trim(),
      fechaInicio: parseDatetimeLocalToUtcIso(formData.fechaInicio),
      fechaFin: parseDatetimeLocalToUtcIso(formData.fechaFin),
      cuposTotales: Number(formData.cuposTotales),
      precioInscripcion: Number(formData.precioInscripcion),
      estado: formData.estado,
      bloqueos: formData.bloqueos.map((b) => ({
        servicioId: Number(b.servicioId),
        horaInicio: parseDatetimeLocalToUtcIso(b.horaInicio),
        horaFin: parseDatetimeLocalToUtcIso(b.horaFin),
      })),
    }

    // VAL-01: Validación cliente utilizando createTournamentSchema de @sportcomplex/validation
    const validationResult = createTournamentSchema.safeParse(payload)
    if (!validationResult.success) {
      const flattened = validationResult.error.flatten()
      setFieldErrors(flattened.fieldErrors as Record<string, string[]>)
      const firstError = Object.values(flattened.fieldErrors)[0]?.[0]
      setErrorMsg(firstError || 'Por favor verifica los campos del formulario.')
      return
    }

    setLoading(true)

    try {
      const url = isEditing
        ? `/api/admin/tournaments/${formData.id}`
        : '/api/admin/tournaments'
      const method = isEditing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        if (json.details?.fieldErrors) {
          setFieldErrors(json.details.fieldErrors)
        }
        if (json.error?.code === 'COURT_SLOT_CONFLICT') {
          setErrorMsg(
            'Conflicto de disponibilidad: Una de las pistas seleccionadas ya tiene reservas activas en ese horario.'
          )
        } else {
          setErrorMsg(
            json.error?.message || 'Error al guardar el torneo en el servidor.'
          )
        }
        setLoading(false)
        return
      }

      notify(
        isEditing
          ? `Torneo «${json.data.titulo}» actualizado correctamente.`
          : `Torneo «${json.data.titulo}» creado con bloqueo preventivo de pistas.`,
        'success'
      )

      onSaved(json.data)
      onClose()
    } catch (err) {
      console.error('Error saving tournament:', err)
      setErrorMsg('Error de red al intentar guardar el torneo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={isEditing ? 'Editar Torneo Deportivo' : 'Crear Torneo Deportivo'}
      description="Configuración de parámetros competitivos, aforo de parejas y bloqueo de pistas."
      onClose={onClose}
      maxWidth="680px"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2"
          >
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label
              htmlFor="torneo-titulo"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Título del Torneo *
            </label>
            <input
              id="torneo-titulo"
              type="text"
              required
              minLength={3}
              maxLength={120}
              placeholder="Ej. Torneo Apertura Pádel 2da Categoría"
              value={formData.titulo}
              onChange={(e) =>
                setFormData({ ...formData, titulo: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {fieldErrors.titulo && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.titulo[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-categoria"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Deporte / Categoría *
            </label>
            <select
              id="torneo-categoria"
              value={formData.categoriaId}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  categoriaId: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {fieldErrors.categoriaId && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.categoriaId[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-nivel"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Nivel de Competición *
            </label>
            <input
              id="torneo-nivel"
              type="text"
              list="niveles-list"
              required
              value={formData.nivel}
              onChange={(e) =>
                setFormData({ ...formData, nivel: e.target.value })
              }
              placeholder="Selecciona o escribe el nivel"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <datalist id="niveles-list">
              {NIVELES_SUGERIDOS.map((niv) => (
                <option key={niv} value={niv} />
              ))}
            </datalist>
            {fieldErrors.nivel && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.nivel[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-fechainicio"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Fecha y Hora de Inicio (Hora Colombia) *
            </label>
            <input
              id="torneo-fechainicio"
              type="datetime-local"
              required
              value={formData.fechaInicio}
              onChange={(e) =>
                setFormData({ ...formData, fechaInicio: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {fieldErrors.fechaInicio && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.fechaInicio[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-fechafin"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Fecha y Hora de Fin (Hora Colombia) *
            </label>
            <input
              id="torneo-fechafin"
              type="datetime-local"
              required
              value={formData.fechaFin}
              onChange={(e) =>
                setFormData({ ...formData, fechaFin: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {fieldErrors.fechaFin && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.fechaFin[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-cupostotales"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Cupos Totales (Jugadores / Parejas) *
            </label>
            <input
              id="torneo-cupostotales"
              type="number"
              min={2}
              max={256}
              required
              value={formData.cuposTotales}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  cuposTotales: parseInt(e.target.value, 10) || 2,
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {fieldErrors.cuposTotales && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.cuposTotales[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-precio"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Precio de Inscripción (COP)
            </label>
            <input
              id="torneo-precio"
              type="number"
              min={0}
              step={1000}
              value={formData.precioInscripcion}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  precioInscripcion: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-[11px] text-slate-500">
              {formData.precioInscripcion === 0
                ? 'Gratuito para participantes'
                : `$${Number(formData.precioInscripcion).toLocaleString('es-CO')}`}
            </span>
            {fieldErrors.precioInscripcion && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.precioInscripcion[0]}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="torneo-estado"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Estado del Torneo
            </label>
            <select
              id="torneo-estado"
              value={formData.estado}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estado: e.target.value as TournamentFormData['estado'],
                })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="BORRADOR">Borrador</option>
              <option value="INSCRIPCIONES_ABIERTAS">Inscripciones Abiertas</option>
              <option value="EN_CURSO">En Curso</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="torneo-descripcion"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Descripción / Reglas / Formato
            </label>
            <textarea
              id="torneo-descripcion"
              rows={2}
              placeholder="Información sobre premios, fases de grupos, reglamento..."
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {fieldErrors.descripcion && (
              <p className="text-rose-500 text-[11px] mt-1">{fieldErrors.descripcion[0]}</p>
            )}
          </div>
        </div>

        {/* Sección de Bloqueo de Pistas */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={15} className="text-amber-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Bloqueo Preventivo de Pistas (ARC-01)
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddBloqueo}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Plus size={13} /> Asignar Pista
            </button>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
            Las pistas seleccionadas quedarán automáticamente bloqueadas para reservas regulares durante las franjas horarias indicadas.
          </p>

          {formData.bloqueos.length === 0 ? (
            <div className="p-3 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-400">
              Sin pistas asignadas. Puedes agregar pistas para que el sistema reserve las franjas automáticamente.
            </div>
          ) : (
            <div className="space-y-2">
              {formData.bloqueos.map((bloqueo, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row items-stretch md:items-center gap-2"
                >
                  <div className="flex-1">
                    <label
                      htmlFor={`bloqueo-servicio-${idx}`}
                      className="sr-only"
                    >
                      Pista deportiva
                    </label>
                    <select
                      id={`bloqueo-servicio-${idx}`}
                      value={bloqueo.servicioId}
                      onChange={(e) =>
                        handleBloqueoChange(
                          idx,
                          'servicioId',
                          Number(e.target.value)
                        )
                      }
                      className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      {filteredServices.length === 0 ? (
                        <option value={0} disabled>
                          No hay pistas disponibles para este deporte
                        </option>
                      ) : (
                        filteredServices.map((serv) => (
                          <option key={serv.id} value={serv.id}>
                            {serv.nombre}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor={`bloqueo-inicio-${idx}`}
                      className="sr-only"
                    >
                      Hora inicio bloqueo
                    </label>
                    <input
                      id={`bloqueo-inicio-${idx}`}
                      type="datetime-local"
                      value={bloqueo.horaInicio}
                      onChange={(e) =>
                        handleBloqueoChange(idx, 'horaInicio', e.target.value)
                      }
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-xs text-slate-400">a</span>
                    <label
                      htmlFor={`bloqueo-fin-${idx}`}
                      className="sr-only"
                    >
                      Hora fin bloqueo
                    </label>
                    <input
                      id={`bloqueo-fin-${idx}`}
                      type="datetime-local"
                      value={bloqueo.horaFin}
                      onChange={(e) =>
                        handleBloqueoChange(idx, 'horaFin', e.target.value)
                      }
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveBloqueo(idx)}
                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded self-end md:self-center"
                    aria-label={`Eliminar bloqueo de pista ${idx + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
          <ActionButton type="button" secondary onClick={onClose} disabled={loading}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={loading}>
            {loading
              ? 'Guardando...'
              : isEditing
                ? 'Actualizar Torneo'
                : 'Crear Torneo'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  )
}
