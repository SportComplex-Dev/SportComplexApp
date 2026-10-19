'use client'

import { QrCode } from 'lucide-react'
import { formatMoney } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import type { UserTournamentItem } from '../../types/portal'
import type { PortalTicket } from '../../utils/portal-utils'

interface TournamentCardProps {
  tournament: UserTournamentItem
  sessionName?: string
  onOpenQR: (ticket: PortalTicket) => void
}

export function TournamentCard({
  tournament,
  sessionName,
  onOpenQR,
}: TournamentCardProps) {
  const ins = tournament.miInscripcion
  const estadoIns = ins?.estado ?? 'CONFIRMADA'
  const isConfirmed = estadoIns === 'CONFIRMADA'
  const qrPayload = ins?.ticketQrPayload || ins?.ticket?.qrPayload || null
  const ticketCode = ins?.ticketCodigoUuid || ins?.ticket?.codigoUuid || (isConfirmed ? `TRN-${tournament.id.slice(0, 8)}` : 'PENDIENTE')
  const inscripcionId = ins?.id || tournament.id
  const precioNum = Number(tournament.precioInscripcion ?? 0)

  const makeFakeBooking = (): PortalTicket => {
    const booking: PortalTicket = {
      id: inscripcionId,
      code: ticketCode,
      service: `Torneo: ${tournament.titulo}`,
      category: tournament.categoria?.nombre || 'Torneo',
      sede: 'Sede Principal',
      date: tournament.fechaInicio.split('T')[0] ?? tournament.fechaInicio,
      time: new Date(tournament.fechaInicio).toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      attendees: ins?.nombrePareja ? 2 : 1,
      amount: precioNum,
      status: isConfirmed ? 'Confirmada' : 'Pendiente',
      client: sessionName || 'Socio',
    }
    if (qrPayload) {
      booking.qrPayload = qrPayload
    }
    return booking
  }

  return (
    <div className="portal-ticket-item">
      <div className="portal-ticket-info">
        <div className="flex items-center gap-2.5">
          <b className="text-base tracking-tight">{tournament.titulo}</b>
          <Badge
            variant={isConfirmed ? 'success' : 'secondary'}
            className="text-[11px] px-2 py-0.5 shrink-0"
          >
            {isConfirmed ? 'Confirmada' : 'Pendiente Pago'}
          </Badge>
        </div>
        <span className="text-xs text-[var(--subtle)] flex flex-wrap items-center gap-2 mt-1">
          <span>
            <strong className="text-[var(--ink)] font-semibold">{ticketCode}</strong>
          </span>
          <span>·</span>
          <span>
            {new Date(tournament.fechaInicio).toLocaleDateString('es-CO', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <span>·</span>
          <span>Nivel: {tournament.nivel}</span>
          {ins?.nombrePareja && (
            <>
              <span>·</span>
              <span>Pareja: <strong>{ins.nombrePareja}</strong></span>
            </>
          )}
          <span>·</span>
          <span>
            {precioNum === 0 ? 'Gratuito' : `${formatMoney(precioNum)} COP`}
          </span>
        </span>
      </div>

      <div className="portal-ticket-actions">
        {isConfirmed ? (
          <>
            <button
              type="button"
              onClick={() => onOpenQR(makeFakeBooking())}
              className="action-button text-xs py-2 px-3.5 gap-2"
            >
              <QrCode size={15} /> Ver QR de Acceso
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              Pago pendiente en taquilla
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
