'use client'

import React, { useEffect, useState } from 'react'
import {
  Users,
  Ticket,
  ShieldCheck,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Modal } from '@/components/modal'
import { ActionButton } from '@/components/action-button'
import {
  TournamentStatusBadge,
  InscriptionStatusBadge,
} from './tournament-status-badge'

export interface BloqueoDetailItem {
  id?: number
  servicioId: number
  servicio?: { nombre: string }
  horaInicio?: string
  horaFin?: string
}

export interface InscripcionDetailItem {
  id: string
  estado: string
  nombrePareja?: string | null
  ticketEstado?: string
  creadoEn?: string
  usuario?: {
    nombre?: string
    correo?: string
  }
}

export interface TournamentDetailData {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { nombre: string }
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposOcupados: number
  precioInscripcion: number | string
  estado: string
  bloqueos?: BloqueoDetailItem[]
  inscripciones?: InscripcionDetailItem[]
}

interface TournamentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string | null
  onStatusChange?: (id: string, newStatus: string) => void
  notify?: (msg: string, kind?: 'success' | 'error' | 'info') => void
}

export function TournamentDetailModal({
  isOpen,
  onClose,
  tournamentId,
  onStatusChange,
}: TournamentDetailModalProps) {
  const [data, setData] = useState<TournamentDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !tournamentId) {
      setData(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/admin/tournaments/${tournamentId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        if (json.success && json.data) {
          setData(json.data)
        } else {
          setError(json.error?.message || 'Error al consultar detalle del torneo.')
        }
      })
      .catch((err) => {
        if (!active) return
        console.error('Error fetching tournament details:', err)
        setError('Error de conexión al cargar la información.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isOpen, tournamentId])

  if (!isOpen) return null

  const cuposTotales = data?.cuposTotales ?? 0
  const cuposOcupados = data?.cuposOcupados ?? 0
  const cuposDisponibles = Math.max(0, cuposTotales - cuposOcupados)
  const pctOcupacion =
    cuposTotales > 0 ? Math.round((cuposOcupados / cuposTotales) * 100) : 0
  const precio = Number(data?.precioInscripcion ?? 0)
  const recaudacionEstimada = cuposOcupados * precio

  const formatFecha = (val: string | Date | undefined) => {
    if (!val) return '-'
    const d = new Date(val)
    return d.toLocaleString('es-CO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    })
  }

  const inscripciones = Array.isArray(data?.inscripciones)
    ? data.inscripciones
    : []
  const bloqueos = Array.isArray(data?.bloqueos) ? data.bloqueos : []

  return (
    <Modal
      title={data?.titulo || 'Detalle del Torneo'}
      description={`Categoría ${data?.categoria?.nombre || ''} · ${data?.nivel || ''}`}
      onClose={onClose}
      maxWidth="780px"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
          <Loader2 size={32} className="animate-spin text-emerald-500" />
          <span className="text-xs">Cargando información del torneo e inscritos...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs text-rose-500 flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-6 pt-2">
          {/* Header de Estadísticas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Estado
              </span>
              <div className="mt-1">
                <TournamentStatusBadge status={data.estado} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Ocupación
              </span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {cuposOcupados}/{cuposTotales}
                </span>
                <span className="text-xs text-slate-500">
                  ({pctOcupacion}% · {cuposDisponibles} disp.)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Precio Inscripción
              </span>
              <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                {precio === 0 ? 'Gratuito' : `$${precio.toLocaleString('es-CO')}`}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Recaudado Est.
              </span>
              <div className="mt-1 text-base font-bold text-emerald-600 dark:text-emerald-400">
                ${recaudacionEstimada.toLocaleString('es-CO')}
              </div>
            </div>
          </div>

          {/* Fechas y Descripción */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Inicio:
                </span>{' '}
                {formatFecha(data.fechaInicio)}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Finalización:
                </span>{' '}
                {formatFecha(data.fechaFin)}
              </div>
            </div>
            {data.descripcion && (
              <p className="text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                {data.descripcion}
              </p>
            )}
          </div>

          {/* Pistas Asignadas / Bloqueadas */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-amber-500" />
              Pistas Bloqueadas Preventivamente ({bloqueos.length})
            </h3>
            {bloqueos.length === 0 ? (
              <div className="p-3 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Este torneo no tiene asignadas pistas con bloqueo automático.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bloqueos.map((b: BloqueoDetailItem, i: number) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                        {b.servicio?.nombre || `Pista #${b.servicioId}`}
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        {formatFecha(b.horaInicio)} a {formatFecha(b.horaFin)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla de Jugadores Inscritos */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Users size={14} className="text-emerald-500" />
              Jugadores y Parejas Inscritas ({inscripciones.length})
            </h3>

            {inscripciones.length === 0 ? (
              <div className="p-6 text-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Aún no hay inscripciones registradas para este torneo.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <div className="max-h-[260px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/80 sticky top-0 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="py-2 px-3">Titular</th>
                        <th className="py-2 px-3">Pareja</th>
                        <th className="py-2 px-3">Estado</th>
                        <th className="py-2 px-3">Ticket</th>
                        <th className="py-2 px-3">Fecha Reg.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-950">
                      {inscripciones.map((ins: InscripcionDetailItem) => (
                        <tr key={ins.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="py-2 px-3">
                            <span className="font-medium text-slate-900 dark:text-slate-100 block">
                              {ins.usuario?.nombre || 'Usuario Registrado'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {ins.usuario?.correo || ''}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {ins.nombrePareja || (
                              <span className="text-slate-400 italic">Individual</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <InscriptionStatusBadge status={ins.estado} />
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                ins.ticketEstado === 'USADO'
                                  ? 'bg-blue-500/10 text-blue-500'
                                  : ins.ticketEstado === 'EMITIDO'
                                    ? 'bg-emerald-500/10 text-emerald-500'
                                    : 'bg-zinc-500/10 text-zinc-400'
                              }`}
                            >
                              <Ticket size={11} />
                              {ins.ticketEstado}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {ins.creadoEn ? new Date(ins.creadoEn).toLocaleDateString('es-CO') : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              {data.estado === 'BORRADOR' && onStatusChange && (
                <button
                  type="button"
                  onClick={() => onStatusChange(data.id, 'INSCRIPCIONES_ABIERTAS')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
                >
                  Abrir Inscripciones
                </button>
              )}
              {data.estado === 'INSCRIPCIONES_ABIERTAS' && onStatusChange && (
                <button
                  type="button"
                  onClick={() => onStatusChange(data.id, 'EN_CURSO')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition"
                >
                  Iniciar Torneo
                </button>
              )}
              {data.estado === 'EN_CURSO' && onStatusChange && (
                <button
                  type="button"
                  onClick={() => onStatusChange(data.id, 'FINALIZADO')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-600 text-white hover:bg-zinc-700 transition"
                >
                  Finalizar Torneo
                </button>
              )}
            </div>

            <ActionButton secondary onClick={onClose}>
              Cerrar
            </ActionButton>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
