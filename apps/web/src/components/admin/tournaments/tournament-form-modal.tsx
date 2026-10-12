'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, AlertCircle, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/modal'
import { ActionButton } from '@/components/action-button'

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

// Convierte un objeto Date o ISO string a formato local para input datetime-local 'YYYY-MM-DDTHH:mm'
function toDatetimeLocal(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
      // Valores por defecto para nuevo torneo
      const now = new Date()
      now.setDate(now.getDate() + 7)
      now.setHours(8, 0, 0, 0)
      const end = new Date(now)
      end.setHours(18, 0, 0, 0)

      setFormData({
        titulo: '',
        descripcion: '',
        categoriaId: categories[0]?.id ?? 1,
        nivel: NIVELES_SUGERIDOS[1],
        fechaInicio: toDatetimeLocal(now),
        fechaFin: toDatetimeLocal(end),
        cuposTotales: 16,
        precioInscripcion: 0,
        estado: 'BORRADOR',
        bloqueos: [],
      })
    }
    setErrorMsg(null)
  }, [tournamentToEdit, categories, isOpen])

  if (!isOpen) return null

  // Filtrar servicios/pistas de la categoría seleccionada
  const filteredServices = services.filter(
    (s) => s.categoriaId === Number(formData.categoriaId)
  )

  const handleAddBloqueo = () => {
    const defaultServiceId = filteredServices[0]?.id || services[0]?.id || 1
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

    if (!formData.titulo.trim() || formData.titulo.trim().length < 3) {
      setErrorMsg('El título del torneo debe tener al menos 3 caracteres.')
      return
    }

    if (!formData.fechaInicio || !formData.fechaFin) {
      setErrorMsg('Debes especificar las fechas y horas de inicio y fin.')
      return
    }

    const dInicio = new Date(formData.fechaInicio)
    const dFin = new Date(formData.fechaFin)

    if (dFin.getTime() <= dInicio.getTime()) {
      setErrorMsg('La fecha y hora de fin debe ser posterior a la de inicio.')
      return
    }

    if (formData.cuposTotales < 2) {
      setErrorMsg('Los cupos totales deben ser al menos 2.')
      return
    }

    // Validar bloqueos
    for (const b of formData.bloqueos) {
      if (!b.horaInicio || !b.horaFin) {
        setErrorMsg('Cada pista bloqueada debe tener horario de inicio y fin.')
        return
      }
      if (new Date(b.horaFin).getTime() <= new Date(b.horaInicio).getTime()) {
        setErrorMsg('El horario de fin del bloqueo debe ser posterior al inicio.')
        return
      }
    }

    setLoading(true)

    try {
      const payload = {
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim() || null,
        categoriaId: Number(formData.categoriaId),
        nivel: formData.nivel.trim(),
        fechaInicio: dInicio.toISOString(),
        fechaFin: dFin.toISOString(),
        cuposTotales: Number(formData.cuposTotales),
        precioInscripcion: Number(formData.precioInscripcion),
        estado: formData.estado,
        bloqueos: formData.bloqueos.map((b) => ({
          servicioId: Number(b.servicioId),
          horaInicio: new Date(b.horaInicio).toISOString(),
          horaFin: new Date(b.horaFin).toISOString(),
        })),
      }

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
    } catch (err: unknown) {
      console.error('Error al guardar torneo:', err)
      setErrorMsg('Ocurrió un error inesperado al conectar con el servidor.')
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
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-lg flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título del Torneo *
            </label>
            <input
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deporte / Categoría *
            </label>
            <select
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nivel de Competición *
            </label>
            <input
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Fecha y Hora de Inicio *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.fechaInicio}
              onChange={(e) =>
                setFormData({ ...formData, fechaInicio: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Fecha y Hora de Fin *
            </label>
            <input
              type="datetime-local"
              required
              value={formData.fechaFin}
              onChange={(e) =>
                setFormData({ ...formData, fechaFin: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Cupos Totales (Jugadores / Parejas) *
            </label>
            <input
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Precio de Inscripción (COP)
            </label>
            <input
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
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Estado del Torneo
            </label>
            <select
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
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descripción / Reglas / Formato
            </label>
            <textarea
              rows={2}
              placeholder="Información sobre premios, fases de grupos, reglamento..."
              value={formData.descripcion}
              onChange={(e) =>
                setFormData({ ...formData, descripcion: e.target.value })
              }
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
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
                    <select
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
                      {services.map((serv) => (
                        <option key={serv.id} value={serv.id}>
                          {serv.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="datetime-local"
                      value={bloqueo.horaInicio}
                      onChange={(e) =>
                        handleBloqueoChange(idx, 'horaInicio', e.target.value)
                      }
                      className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-xs text-slate-400">a</span>
                    <input
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
                    aria-label="Eliminar bloqueo"
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
