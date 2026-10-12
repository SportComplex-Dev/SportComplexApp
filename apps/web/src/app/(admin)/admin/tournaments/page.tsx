'use client'

import React, { useState, useEffect, useCallback } from 'react'
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

interface TorneoAdminItem {
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
  bloqueos?: Array<{ id: number; servicioId: number; servicio?: { nombre: string } }>
  _count?: { inscripciones: number }
}

export default function AdminTournamentsPage() {
  const { notify } = useApp()

  const [tournaments, setTournaments] = useState<TorneoAdminItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; nombre: string }>>([])
  const [services, setServices] = useState<Array<{ id: number; nombre: string; categoriaId: number }>>([])

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('todas')
  const [selectedStatus, setSelectedStatus] = useState<string>('todos')

  // Modales
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTournament, setEditingTournament] = useState<TorneoAdminItem | null>(null)
  const [detailTournamentId, setDetailTournamentId] = useState<string | null>(null)
  const [deletingTournament, setDeletingTournament] = useState<TorneoAdminItem | null>(null)

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

  // Carga de torneos desde la API
  const loadTournaments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedStatus !== 'todos') {
        params.append('estado', selectedStatus)
      }
      if (selectedCategory !== 'todas') {
        params.append('categoriaId', selectedCategory)
      }
      if (search.trim()) {
        params.append('search', search.trim())
      }

      const res = await fetch(`/api/admin/tournaments?${params.toString()}`)
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setTournaments(json.data)
      } else {
        notify('Error al obtener la lista de torneos', 'error')
      }
    } catch (err) {
      console.error('Error fetching tournaments:', err)
      notify('Error de red al consultar los torneos', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedStatus, selectedCategory, search, notify])

  useEffect(() => {
    loadPrerequisites()
  }, [loadPrerequisites])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  // Métricas de cabecera
  const totalTorneos = tournaments.length
  const torneosAbiertos = tournaments.filter((t) => t.estado === 'INSCRIPCIONES_ABIERTAS').length
  const torneosEnCurso = tournaments.filter((t) => t.estado === 'EN_CURSO').length
  const totalInscripciones = tournaments.reduce(
    (acc, t) => acc + (t.cuposOcupados ?? t._count?.inscripciones ?? 0),
    0
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

      {/* Consola de Filtros */}
      <section className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Input de Búsqueda */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar torneo por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Filtro por Categoría / Deporte */}
        <div className="flex items-center gap-2">
          <select
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
          <select
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
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-emerald-500" />
            <span className="text-xs">Cargando torneos y asignación de pistas...</span>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="py-16 text-center text-slate-500 dark:text-slate-400 space-y-3">
            <Trophy size={40} className="mx-auto text-slate-300 dark:text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No se encontraron torneos
            </h3>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              {search || selectedCategory !== 'todas' || selectedStatus !== 'todos'
                ? 'No hay resultados que coincidan con los filtros seleccionados.'
                : 'Aún no se han configurado torneos deportivos en la plataforma.'}
            </p>
            <ActionButton size="sm" onClick={handleOpenCreate}>
              <Plus size={14} /> Crear Primer Torneo
            </ActionButton>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Torneo & Nivel</th>
                  <th className="py-3 px-4">Deporte</th>
                  <th className="py-3 px-4">Fechas</th>
                  <th className="py-3 px-4">Aforo / Cupos</th>
                  <th className="py-3 px-4">Inscripción</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {tournaments.map((torneo) => {
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
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {torneo.categoria?.nombre || 'General'}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col text-slate-600 dark:text-slate-400">
                          <span>{formatFecha(torneo.fechaInicio)}</span>
                          <span className="text-[10px] text-slate-400">
                            al {formatFecha(torneo.fechaFin)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[140px]">
                        <div className="space-y-1">
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
                            aria-label="Ver inscritos"
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEdit(torneo)}
                            className="p-1.5 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-500/10 transition"
                            title="Editar parámetros"
                            aria-label="Editar torneo"
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
                              aria-label="Cancelar torneo"
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
          </div>
        )}
      </section>

      {/* Modal Formulario Crear / Editar */}
      <TournamentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        tournamentToEdit={editingTournament}
        categories={categories}
        services={services}
        onSaved={loadTournaments}
        notify={notify}
      />

      {/* Modal Detalle e Inscritos */}
      <TournamentDetailModal
        isOpen={Boolean(detailTournamentId)}
        onClose={() => setDetailTournamentId(null)}
        tournamentId={detailTournamentId}
        onStatusChange={(id, newStatus) => {
          handleStatusTransition(id, newStatus)
          setDetailTournamentId(null)
        }}
        notify={notify}
      />

      {/* Diálogo de Confirmación para Cancelar/Eliminar */}
      {deletingTournament && (
        <ConfirmDialog
          title="¿Confirmas la cancelación del torneo?"
          message={`El torneo «${deletingTournament.titulo}» pasará a estado cancelado y se liberarán de inmediato los bloqueos automáticos de las pistas asignadas.`}
          confirmLabel="Cancelar Torneo"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTournament(null)}
        />
      )}
    </div>
  )
}
