'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Trophy,
  Plus,
  Search,
  Calendar,
  Users,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from 'lucide-react'
import { PageHeading } from '@/components/page-heading'
import { ActionButton } from '@/components/action-button'
import { ConfirmDialog } from '@/components/modal'
import { useApp } from '@/components/app-provider'
import {
  TournamentStatusBadge,
  type EstadoTorneoTipo,
} from '@/components/admin/tournaments/tournament-status-badge'
import { TournamentFormModal } from '@/components/admin/tournaments/tournament-form-modal'
import { TournamentDetailModal } from '@/components/admin/tournaments/tournament-detail-modal'

export interface TorneoAdminItem {
  id: string
  titulo: string
  descripcion: string | null
  categoriaId: number
  categoria?: { id: number; nombre: string }
  nivel: string
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposOcupados: number
  precioInscripcion: number | string
  estado: EstadoTorneoTipo
  bloqueos?: Array<{
    id: number
    servicioId: number
    horaInicio: string
    horaFin: string
    servicio?: { nombre: string }
  }>
  _count?: { inscripciones: number }
}

const PAGE_SIZE = 10

export default function AdminTournamentsPage() {
  const { notify } = useApp()

  const [tournaments, setTournaments] = useState<TorneoAdminItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; nombre: string }>>([])
  const [services, setServices] = useState<Array<{ id: number; nombre: string; categoriaId: number }>>([])

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Referencia a AbortController para cancelar peticiones en vuelo (PERF-01)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<TorneoAdminItem | null>(null)
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null)
  const [deletingTournament, setDeletingTournament] = useState<TorneoAdminItem | null>(null)

  // PERF-01: Debounce de 300ms sobre el campo de búsqueda
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  // Reiniciar a página 1 cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, selectedStatus])

  // Carga de categorías y servicios para los selectores
  const loadPrerequisites = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/services')
      const json = await res.json()
      if (json.success && json.data) {
        if (Array.isArray(json.data.categories)) {
          setCategories(json.data.categories)
        }
        if (Array.isArray(json.data.services)) {
          setServices(
            json.data.services.map((s: { id: number; nombre: string; categoriaId: number }) => ({
              id: s.id,
              nombre: s.nombre,
              categoriaId: s.categoriaId,
            }))
          )
        }
      }
    } catch (err) {
      console.error('Error loading services and categories:', err)
    }
  }, [])

  // Carga de torneos desde la API con soporte de AbortController
  const loadTournaments = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStatus !== 'todos') {
        params.append('estado', selectedStatus)
      }
      if (selectedCategory !== 'todas') {
        params.append('categoriaId', selectedCategory)
      }
      if (debouncedSearch.trim()) {
        params.append('search', debouncedSearch.trim())
      }

      const res = await fetch(`/api/admin/tournaments?${params.toString()}`, {
        signal: controller.signal,
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setTournaments(json.data)
      } else {
        notify('Error al obtener la lista de torneos', 'error')
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      console.error('Error fetching tournaments:', err)
      notify('Error de red al consultar los torneos', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedCategory, debouncedSearch, notify])

  useEffect(() => {
    loadPrerequisites()
  }, [loadPrerequisites])

  useEffect(() => {
    loadTournaments()
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadTournaments])

  // Métricas de cabecera (KPIs globales)
  const totalTorneos = tournaments.length
  const torneosAbiertos = tournaments.filter((t) => t.estado === 'INSCRIPCIONES_ABIERTAS').length
  const torneosEnCurso = tournaments.filter((t) => t.estado === 'EN_CURSO').length
  const totalInscripciones = tournaments.reduce(
    (acc, t) => acc + (t.cuposOcupados ?? t._count?.inscripciones ?? 0),
    0
  )

  // SCAL-01: Paginación reactiva
  const totalPages = Math.max(1, Math.ceil(tournaments.length / PAGE_SIZE))
  const paginatedTournaments = tournaments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const handleOpenCreate = () => {
    setEditingTournament(null)
    setIsFormOpen(true)
  }

  const handleOpenEdit = (t: TorneoAdminItem) => {
    setEditingTournament(t)
    setIsFormOpen(true)
  }

  const handleStatusTransition = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/tournaments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        notify(`Estado actualizado a «${newStatus}»`, 'success')
        loadTournaments()
      } else {
        notify(json.error?.message || 'Error al cambiar el estado del torneo', 'error')
      }
    } catch (err) {
      console.error('Error updating tournament status:', err)
      notify('Error de conexión al actualizar estado', 'error')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deletingTournament) return
    try {
      const res = await fetch(`/api/admin/tournaments/${deletingTournament.id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (res.ok && json.success) {
        notify('Torneo cancelado/eliminado y bloqueos liberados correctamente', 'success')
        setDeletingTournament(null)
        loadTournaments()
      } else {
        notify(json.error?.message || 'Error al eliminar torneo', 'error')
      }
    } catch (err) {
      console.error('Error deleting tournament:', err)
      notify('Error de conexión al eliminar torneo', 'error')
    }
  }

  const formatFecha = (iso: string) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota',
    })
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="PANEL DE ADMINISTRACIÓN"
        title="Gestión de Torneos"
        description="Creación y control de torneos competitivos, motor de bloqueo preventivo de pistas y administración de participantes (TSK-FE-25)."
        action={
          <div className="flex items-center gap-2">
            <ActionButton secondary onClick={loadTournaments}>
              <RefreshCw size={14} /> Refrescar
            </ActionButton>
            <ActionButton onClick={handleOpenCreate}>
              <Plus size={16} /> Crear Torneo
            </ActionButton>
          </div>
        }
      />

      {/* Tarjetas de Métricas (KPIs) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Torneos</span>
            <Trophy size={16} className="text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalTorneos}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Inscripciones Abiertas</span>
            <CheckCircle2 size={16} className="text-emerald-500" />
          </div>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {torneosAbiertos}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">En Curso</span>
            <Calendar size={16} className="text-blue-500" />
          </div>
          <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {torneosEnCurso}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Jugadores Inscritos</span>
            <Users size={16} className="text-purple-500" />
          </div>
          <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {totalInscripciones}
          </span>
        </div>
      </section>

      {/* Consola de Filtros con Accesibilidad WCAG */}
      <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Input de Búsqueda */}
        <div className="relative flex-1">
          <label htmlFor="admin-search-tournament" className="sr-only">
            Buscar torneo por título
          </label>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            id="admin-search-tournament"
            type="text"
            placeholder="Buscar torneo por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filtro por Categoría / Deporte */}
        <div className="flex items-center gap-2">
          <label htmlFor="admin-category-filter" className="sr-only">
            Filtrar por deporte o categoría
          </label>
          <select
            id="admin-category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todas">Todos los deportes</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          {/* Filtro por Estado */}
          <label htmlFor="admin-status-filter" className="sr-only">
            Filtrar por estado del torneo
          </label>
          <select
            id="admin-status-filter"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="BORRADOR">Borrador</option>
            <option value="INSCRIPCIONES_ABIERTAS">Inscripciones Abiertas</option>
            <option value="EN_CURSO">En Curso</option>
            <option value="FINALIZADO">Finalizado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
      </section>

      {/* Tabla de Torneos */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
            <span className="text-xs">Cargando torneos y disponibilidades...</span>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Trophy size={32} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No se encontraron torneos
            </p>
            <p className="text-xs text-slate-400">
              {search || selectedCategory !== 'todas' || selectedStatus !== 'todos'
                ? 'Prueba modificando los filtros de búsqueda.'
                : 'Crea tu primer torneo deportivo para iniciar.'}
            </p>
            <ActionButton onClick={handleOpenCreate} className="mt-2">
              <Plus size={14} /> Crear Primer Torneo
            </ActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="py-3 px-4">Torneo & Nivel</th>
                  <th scope="col" className="py-3 px-4">Deporte</th>
                  <th scope="col" className="py-3 px-4">Fechas</th>
                  <th scope="col" className="py-3 px-4">Aforo / Cupos</th>
                  <th scope="col" className="py-3 px-4">Inscripción</th>
                  <th scope="col" className="py-3 px-4">Estado</th>
                  <th scope="col" className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {paginatedTournaments.map((torneo) => {
                  const ocupados = torneo.cuposOcupados ?? torneo._count?.inscripciones ?? 0
                  const totales = torneo.cuposTotales
                  const pct = Math.min(100, Math.round((ocupados / totales) * 100))
                  const precio = Number(torneo.precioInscripcion)

                  return (
                    <tr
                      key={torneo.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => setDetailTournamentId(torneo.id)}
                            className="text-left font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                          >
                            {torneo.titulo}
                          </button>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {torneo.nivel}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {torneo.categoria?.nombre ?? 'General'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col text-[11px] text-slate-600 dark:text-slate-400">
                          <span>{formatFecha(torneo.fechaInicio)}</span>
                          <span className="text-slate-400 text-[10px]">
                            hasta {formatFecha(torneo.fechaFin)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="w-28 space-y-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {ocupados}/{totales}
                            </span>
                            <span className="text-slate-400">{pct}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 100
                                  ? 'bg-rose-500'
                                  : pct > 75
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {precio === 0 ? 'Gratuito' : `$${precio.toLocaleString('es-CO')}`}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <TournamentStatusBadge status={torneo.estado} />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailTournamentId(torneo.id)}
                            className="p-1.5 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-500/10 transition"
                            title="Ver inscritos y detalle"
                            aria-label={`Ver inscritos y detalle del torneo ${torneo.titulo}`}
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(torneo)}
                            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition"
                            title="Editar parámetros"
                            aria-label={`Editar torneo ${torneo.titulo}`}
                          >
                            <Pencil size={15} />
                          </button>

                          {torneo.estado === 'BORRADOR' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleStatusTransition(torneo.id, 'INSCRIPCIONES_ABIERTAS')
                              }
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20 transition"
                              title="Abrir inscripciones al público"
                              aria-label={`Publicar e iniciar inscripciones del torneo ${torneo.titulo}`}
                            >
                              Publicar
                            </button>
                          )}

                          {torneo.estado !== 'CANCELADO' && (
                            <button
                              type="button"
                              onClick={() => setDeletingTournament(torneo)}
                              className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition"
                              title="Cancelar torneo"
                              aria-label={`Cancelar torneo ${torneo.titulo}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* SCAL-01: Controles de Paginación */}
            {tournaments.length > PAGE_SIZE && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 gap-2">
                <span>
                  Mostrando {(currentPage - 1) * PAGE_SIZE + 1} a{' '}
                  {Math.min(currentPage * PAGE_SIZE, tournaments.length)} de {tournaments.length} torneos
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Anterior
                  </button>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal de Creación / Edición */}
      <TournamentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        tournamentToEdit={editingTournament}
        categories={categories}
        services={services}
        onSaved={loadTournaments}
        notify={notify}
      />

      {/* Modal de Detalle y Participantes */}
      <TournamentDetailModal
        isOpen={Boolean(detailTournamentId)}
        tournamentId={detailTournamentId}
        onClose={() => setDetailTournamentId(null)}
        notify={notify}
        onStatusChange={loadTournaments}
      />

      {/* Diálogo de Confirmación para Cancelar Torneo */}
      {deletingTournament && (
        <ConfirmDialog
          title="Cancelar Torneo Deportivo"
          message={`¿Estás seguro de que deseas cancelar el torneo «${deletingTournament.titulo}»? Se liberarán todas las pistas bloqueadas automáticamente.`}
          confirmLabel="Sí, cancelar torneo"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTournament(null)}
        />
      )}
    </div>
  )
}
