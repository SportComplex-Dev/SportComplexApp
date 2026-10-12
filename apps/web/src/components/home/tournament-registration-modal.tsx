'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Ticket,
  Lock,
  Loader2,
} from 'lucide-react'
import { Modal } from '@/components/modal'
import { ActionButton } from '@/components/action-button'
import { Input } from '@sportcomplex/ui'
import { useApp } from '@/components/app-provider'

export interface TournamentRegisterTarget {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { id: number; nombre: string }
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposDisponibles: number
  cuposOcupados: number
  precioInscripcion: number | string
  yaInscrito?: boolean
}

interface TournamentRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  tournament: TournamentRegisterTarget | null
  onRegistrationSuccess?: (tournamentId: string) => void
}

export function TournamentRegistrationModal({
  isOpen,
  onClose,
  tournament,
  onRegistrationSuccess,
}: TournamentRegistrationModalProps) {
  const router = useRouter()
  const { session, notify } = useApp()

  const [nombrePareja, setNombrePareja] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successTicket, setSuccessTicket] = useState<{ id: string; codigo: string } | null>(null)

  if (!isOpen || !tournament) return null

  const isAuthenticated = Boolean(session?.email)
  const precio = Number(tournament.precioInscripcion ?? 0)
  const esGratuito = precio === 0
  const cuposRestantes = tournament.cuposDisponibles ?? Math.max(0, tournament.cuposTotales - tournament.cuposOcupados)
  const cuposAgotados = cuposRestantes <= 0

  const handleClose = () => {
    setNombrePareja('')
    setErrorMessage(null)
    setSuccessTicket(null)
    onClose()
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    setSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/tournaments/${tournament.id}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombrePareja: nombrePareja.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        const code = json.error?.code
        if (code === 'ALREADY_REGISTERED') {
          setErrorMessage('Ya te encuentras formalmente inscrito en este torneo deportivo.')
        } else if (code === 'CAPACITY_EXCEEDED') {
          setErrorMessage('Los cupos disponibles se han agotado.')
        } else if (code === 'REGISTRATION_CLOSED') {
          setErrorMessage('Las inscripciones para este torneo se encuentran temporalmente cerradas.')
        } else {
          setErrorMessage(json.error?.message || 'Error al procesar la inscripción.')
        }
        return
      }

      notify('¡Inscripción confirmada con éxito!', 'success')

      if (json.data?.ticket) {
        setSuccessTicket(json.data.ticket)
      }

      if (onRegistrationSuccess) {
        onRegistrationSuccess(tournament.id)
      }
    } catch (err) {
      console.error('Error registrando en torneo:', err)
      setErrorMessage('No pudimos conectar con el servidor. Revisa tu conexión a internet.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      onClose={handleClose}
      title="Inscripción a Torneo Deportivo"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 pt-1">
        {/* Banner de Información del Torneo */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {tournament.categoria?.nombre || 'Torneo Oficial'}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {tournament.titulo}
              </h3>
            </div>
            <div className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
              {esGratuito ? 'Gratuito' : `$${precio.toLocaleString('es-CO')} COP`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-emerald-500" />
              <span>
                {new Date(tournament.fechaInicio).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                -{' '}
                {new Date(tournament.fechaFin).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={13} className="text-blue-500" />
              <span>{cuposRestantes} cupos disponibles</span>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Nivel requerido: <b className="text-slate-800 dark:text-slate-200">{tournament.nivel}</b>
          </div>
        </div>

        {/* Estado si ya fue exitosa la inscripción */}
        {successTicket ? (
          <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
              ¡Tu cupo ha sido reservado exitosamente!
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Se ha emitido tu entrada de acceso digital con código seguro:{' '}
              <code className="font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">
                {successTicket.codigo}
              </code>
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <ActionButton
                onClick={() => {
                  handleClose()
                  router.push('/portal/tickets')
                }}
                className="w-full sm:w-auto"
              >
                <Ticket size={14} /> Ver Entrada en Mi Portal
              </ActionButton>
              <ActionButton secondary onClick={handleClose} className="w-full sm:w-auto">
                Cerrar
              </ActionButton>
            </div>
          </div>
        ) : tournament.yaInscrito ? (
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center space-y-3">
            <CheckCircle2 size={32} className="mx-auto text-blue-600 dark:text-blue-400" />
            <p className="text-xs text-blue-800 dark:text-blue-200 font-semibold">
              Ya estás inscrito en este torneo deportivo. Puedes revisar tu pase de ingreso en la sección de tickets.
            </p>
            <ActionButton
              onClick={() => {
                handleClose()
                router.push('/portal/tickets')
              }}
            >
              <Ticket size={14} /> Ir a mis Entradas
            </ActionButton>
          </div>
        ) : cuposAgotados ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle size={16} />
            Este torneo ha completado su aforo máximo. No hay cupos disponibles.
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            {!isAuthenticated ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-semibold text-xs">
                  <Lock size={14} />
                  Inicio de sesión requerido
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Para registrarte y emitir tu entrada oficial con código QR firmado, debes iniciar sesión con tu cuenta de socio o cliente.
                </p>
                <ActionButton
                  type="button"
                  onClick={() => router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)}
                  className="w-full mt-2"
                >
                  Iniciar Sesión
                </ActionButton>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Nombre de Pareja o Compañero (Opcional)</span>
                    <span className="text-[11px] text-slate-400">Dobles / Parejas</span>
                  </label>
                  <Input
                    type="text"
                    value={nombrePareja}
                    onChange={(e) => setNombrePareja(e.target.value)}
                    placeholder="Ej. Juan Pérez (Dejar en blanco si es individual)"
                    maxLength={100}
                  />
                  <p className="text-[11px] text-slate-400">
                    Si el torneo se juega en modalidad por equipos o dobles, tu compañero quedará formalmente registrado con este pase.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <ActionButton secondary onClick={handleClose} disabled={submitting}>
                    Cancelar
                  </ActionButton>
                  <ActionButton type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Registrando...
                      </>
                    ) : (
                      <>
                        <Trophy size={14} /> Confirmar Inscripción
                      </>
                    )}
                  </ActionButton>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </Modal>
  )
}
