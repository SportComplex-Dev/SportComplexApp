'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldCheck,
  Gift,
  ArrowRight,
  Ticket,
} from 'lucide-react'
import { Modal } from '@/components/modal'
import { ActionButton } from '@/components/action-button'
import type { TournamentRegisterTarget } from './tournament-registration-modal'

export interface PublicTournamentDetailData extends TournamentRegisterTarget {
  court?: string
  sede?: string
  tone?: 'lime' | 'blue' | 'orange' | 'purple'
  bloqueos?: Array<{
    servicio?: { nombre: string }
    horaInicio?: string
    horaFin?: string
  }>
}

interface PublicTournamentDetailModalProps {
  isOpen: boolean
  onClose: () => void
  tournament: PublicTournamentDetailData | null
  onRegisterClick: (tournament: PublicTournamentDetailData) => void
}

export function PublicTournamentDetailModal({
  isOpen,
  onClose,
  tournament,
  onRegisterClick,
}: PublicTournamentDetailModalProps) {
  const router = useRouter()

  if (!isOpen || !tournament) return null

  const precio = Number(tournament.precioInscripcion ?? 0)
  const esGratuito = precio === 0
  const cuposRestantes =
    tournament.cuposDisponibles ?? Math.max(0, tournament.cuposTotales - tournament.cuposOcupados)
  const cuposAgotados = cuposRestantes <= 0
  const pctOcupado = Math.min(
    100,
    Math.round(((tournament.cuposTotales - cuposRestantes) / Math.max(1, tournament.cuposTotales)) * 100)
  )

  const fechaInicioObj = new Date(tournament.fechaInicio)
  const fechaFinObj = new Date(tournament.fechaFin)

  const fechaStr = fechaInicioObj.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const horarioStr = `${fechaInicioObj.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })} - ${fechaFinObj.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  })}`

  const courtName =
    tournament.court ||
    (tournament.bloqueos && tournament.bloqueos[0]?.servicio?.nombre) ||
    'Pistas Oficiales Asignadas'

  const sedeName = tournament.sede || 'Sede Principal SportComplex'

  return (
    <Modal
      onClose={onClose}
      title="Información Oficial del Torneo"
      maxWidth="620px"
    >
      <div className="space-y-5 pt-2">
        {/* Cabecera visual con badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Trophy size={13} /> {tournament.categoria?.nombre || 'Torneo Deportivo'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Nivel: {tournament.nivel}
            </span>
          </div>

          <div>
            {cuposAgotados ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                <AlertCircle size={13} /> Cupos Agotados
              </span>
            ) : tournament.yaInscrito ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                <CheckCircle2 size={13} /> Inscrito Formalmente
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 size={13} /> Inscripciones Abiertas
              </span>
            )}
          </div>
        </div>

        {/* Título y descripción */}
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
            {tournament.titulo}
          </h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {tournament.descripcion ||
              'Participa en la máxima competencia interna del club con arbitraje avalado, control de aforo y pase digital.'}
          </p>
        </div>

        {/* Grid de Metadatos: Horario, Sede, Precio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-start gap-2.5">
            <Calendar size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300 capitalize">
                {fechaStr}
              </span>
              <span className="text-slate-500 flex items-center gap-1 mt-0.5">
                <Clock size={12} /> {horarioStr}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300">
                {courtName}
              </span>
              <span className="text-slate-500 mt-0.5 block">{sedeName}</span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 sm:border-t-0 sm:pt-0">
            <Tag size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300">
                {esGratuito ? 'Inscripción Gratuita' : `$${precio.toLocaleString('es-CO')} COP`}
              </span>
              <span className="text-slate-500 mt-0.5 block">
                {esGratuito ? 'Acceso libre para socios del club' : 'Costo total por pareja/equipo'}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 sm:border-t-0 sm:pt-0">
            <Users size={16} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-700 dark:text-slate-300">
                {cuposRestantes} cupos disponibles
              </span>
              <span className="text-slate-500 mt-0.5 block">
                Aforo total: {tournament.cuposTotales} participantes
              </span>
            </div>
          </div>
        </div>

        {/* Medidor de aforo / progreso */}
        <div className="space-y-1.5 p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-600 dark:text-slate-400 font-medium">
              Ocupación del torneo: {tournament.cuposTotales - cuposRestantes} / {tournament.cuposTotales}
            </span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{pctOcupado}% completado</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pctOcupado}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje de ocupación del torneo"
            className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 ${
                cuposRestantes <= 3 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${pctOcupado}%` }}
            />
          </div>
        </div>

        {/* Beneficios & Normas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-2">
            <Gift size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-slate-600 dark:text-slate-400">
              <b className="text-slate-800 dark:text-slate-200 block">Kit & Premiación</b>
              Hidratación isotónica, bolas oficiales y trofeos para podio.
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-start gap-2">
            <ShieldCheck size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="text-slate-600 dark:text-slate-400">
              <b className="text-slate-800 dark:text-slate-200 block">Acceso Controlado</b>
              Ticket digital con código QR firmado e ingreso seguro.
            </div>
          </div>
        </div>

        {/* Footer con Acciones */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <ActionButton secondary onClick={onClose} className="w-full sm:w-auto">
            Cerrar
          </ActionButton>

          {tournament.yaInscrito ? (
            <ActionButton
              onClick={() => {
                onClose()
                router.push('/portal/tickets')
              }}
              className="w-full sm:w-auto"
            >
              <Ticket size={14} /> Ver mi Entrada en el Portal
            </ActionButton>
          ) : cuposAgotados ? (
            <ActionButton secondary disabled className="w-full sm:w-auto opacity-70">
              <AlertCircle size={14} /> Sin Cupos Disponibles
            </ActionButton>
          ) : (
            <ActionButton
              onClick={() => {
                onClose()
                onRegisterClick(tournament)
              }}
              className="w-full sm:w-auto"
            >
              Inscribirme al Torneo <ArrowRight size={14} />
            </ActionButton>
          )}
        </div>
      </div>
    </Modal>
  )
}
