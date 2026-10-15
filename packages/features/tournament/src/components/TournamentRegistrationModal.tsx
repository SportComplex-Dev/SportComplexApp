'use client'

import React, { useState } from 'react'
import {
  Trophy,
  Users,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Lock,
  Loader2,
  Ticket,
  Clock,
  CircleDollarSign,
} from 'lucide-react'
import { Modal } from '@sportcomplex/ui'
import { ActionButton } from '@sportcomplex/ui'
import { Input } from '@sportcomplex/ui'
import type {
  TournamentRegisterTarget,
  IssuedTournamentTicket,
} from '../types'

export type { TournamentRegisterTarget, IssuedTournamentTicket }

export interface TournamentUserSession {
  email?: string | null
  name?: string | null
  role?: string | null
}

export interface TournamentRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  tournament: TournamentRegisterTarget | null
  onRegistrationSuccess?: (tournamentId: string) => void
  session?: TournamentUserSession | null
  notify?: (msg: string, kind?: 'success' | 'error' | 'info') => void
  onNavigateToLogin?: (callbackUrl: string) => void
  onNavigateToTickets?: () => void
}

export function TournamentRegistrationModal({
  isOpen,
  onClose,
  tournament,
  onRegistrationSuccess,
  session,
  notify = () => {},
  onNavigateToLogin,
  onNavigateToTickets,
}: TournamentRegistrationModalProps) {
  const [nombrePareja, setNombrePareja] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successTicket, setSuccessTicket] = useState<IssuedTournamentTicket | null>(null)
  const [pendingPayment, setPendingPayment] = useState(false)

  if (!isOpen || !tournament) return null

  const isAuthenticated = Boolean(session?.email)
  const precio = Number(tournament.precioInscripcion ?? 0)
  const esGratuito = precio === 0
  const existingPendingPayment = tournament.miInscripcion?.estado === 'PENDIENTE_PAGO'
  const cuposRestantes = tournament.cuposDisponibles ?? Math.max(0, tournament.cuposTotales - tournament.cuposOcupados)
  const cuposAgotados = cuposRestantes <= 0

  const handleClose = () => {
    setNombrePareja('')
    setErrorMessage(null)
    setSuccessTicket(null)
    setPendingPayment(false)
    onClose()
  }

  const navigateToLogin = () => {
    const callbackUrl = typeof window !== 'undefined' ? window.location.pathname : '/'
    if (onNavigateToLogin) {
      onNavigateToLogin(callbackUrl)
    } else if (typeof window !== 'undefined') {
      window.location.assign(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
    }
  }

  const navigateToTickets = () => {
    handleClose()
    if (onNavigateToTickets) {
      onNavigateToTickets()
    } else if (typeof window !== 'undefined') {
      window.location.assign('/portal/tickets')
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAuthenticated) {
      navigateToLogin()
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

      // BUS-01: Si el torneo tiene costo o quedó PENDIENTE_PAGO, notificar pago pendiente sin simular confirmación
      if (json.data?.estado === 'PENDIENTE_PAGO' || (!esGratuito && !json.data?.ticket)) {
        setPendingPayment(true)
        notify('Inscripción registrada. Recuerda completar el pago para confirmar tu cupo y obtener tu QR.', 'info')
      } else {
        notify('¡Inscripción confirmada con éxito!', 'success')
        // INT-01: Mapear contrato de ticket { codigoUuid, firma, qrPayload }
        if (json.data?.ticket) {
          const t = json.data.ticket
          setSuccessTicket({
            ...t,
            codigo: t.codigo ?? t.codigoUuid ?? t.id ?? 'TICKET-OK',
          })
        }
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
      maxWidth="540px"
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
            <div className="text-right">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {esGratuito ? 'Gratuito' : `$${precio.toLocaleString('es-CO')} COP`}
              </span>
              <span className="block text-[11px] text-slate-400">
                {esGratuito ? 'Entrada Libre' : 'Pago por pareja'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Calendar size={13} className="text-emerald-500" />
              <span>
                {new Date(tournament.fechaInicio).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'America/Bogota',
                })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Users size={13} className="text-emerald-500" />
              <span>
                {cuposRestantes} cupos libres de {tournament.cuposTotales}
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Nivel requerido: <b className="text-slate-800 dark:text-slate-200">{tournament.nivel}</b>
          </div>
        </div>

        {/* BUS-01: Estado de inscripción con pago pendiente */}
        {pendingPayment || existingPendingPayment ? (
          <div className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
            <Clock size={36} className="mx-auto text-amber-600 dark:text-amber-400" />
            <h4 className="text-base font-bold text-amber-800 dark:text-amber-200">
              Inscripción pendiente de pago
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Esta inscripción todavía no está confirmada y no tiene un QR de acceso válido. El portal no procesa pagos de torneos; contacta a recepción para conocer las opciones disponibles y activar tu cupo.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <ActionButton
                onClick={navigateToTickets}
                className="w-full sm:w-auto"
              >
                <Ticket size={14} /> Ir a mis Inscripciones
              </ActionButton>
              <ActionButton secondary onClick={handleClose} className="w-full sm:w-auto">
                Cerrar
              </ActionButton>
            </div>
          </div>
        ) : successTicket ? (
          /* INT-01: Estado si ya fue exitosa la inscripción gratuita o confirmada con ticket */
          <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
              ¡Tu cupo ha sido reservado exitosamente!
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Se ha emitido tu entrada de acceso digital con código seguro:{' '}
              <code className="font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/30">
                {successTicket.codigo || successTicket.codigoUuid}
              </code>
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
              <ActionButton
                onClick={navigateToTickets}
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
              onClick={navigateToTickets}
            >
              <Ticket size={14} /> Ir a mis Entradas
            </ActionButton>
          </div>
        ) : cuposAgotados ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            <AlertCircle size={16} />
            Este torneo ha completado su aforo máximo. No hay cupos disponibles.
          </div>
        ) : !esGratuito ? (
          <div
            role="status"
            className="p-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3"
          >
            <CircleDollarSign size={36} className="mx-auto text-amber-600 dark:text-amber-400" />
            <h4 className="text-base font-bold text-amber-800 dark:text-amber-200">
              Inscripción con pago presencial
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              La inscripción cuesta <b>${precio.toLocaleString('es-CO')} COP</b>. Este portal todavía no
              permite registrar ni cobrar torneos con costo, así que no creará una inscripción ni reservará un
              cupo. Contacta a recepción para conocer las opciones disponibles.
            </p>
            <ActionButton secondary onClick={handleClose} className="w-full sm:w-auto">
              Entendido
            </ActionButton>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs"
              >
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
                  onClick={navigateToLogin}
                  className="w-full mt-2"
                >
                  Iniciar Sesión
                </ActionButton>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="pareja-nombre"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between"
                  >
                    <span>Nombre de Pareja o Compañero (Opcional)</span>
                    <span className="text-[11px] text-slate-400">Dobles / Parejas</span>
                  </label>
                  <Input
                    id="pareja-nombre"
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

