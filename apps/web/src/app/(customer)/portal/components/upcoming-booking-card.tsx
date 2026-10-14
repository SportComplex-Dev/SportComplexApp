'use client'

import Link from 'next/link'
import { ArrowRight, CalendarCheck, CalendarDays, QrCode } from 'lucide-react'
import { formatDate, formatMoney } from '@sportcomplex/core'
import type { PortalTicket } from '@/components/portal/portal-utils'

interface UpcomingBookingCardProps {
  booking: PortalTicket | null
  onOpenQR: (booking: PortalTicket) => void
}

export function UpcomingBookingCard({ booking, onOpenQR }: UpcomingBookingCardProps) {
  if (!booking) {
    return (
      <div className="dashboard-empty">
        <span className="empty-icon">
          <CalendarDays size={21} />
        </span>
        <div>
          <b>Aún no tienes reservas programadas</b>
          <p>Encuentra un espacio y empieza a planear tu próximo partido o sesión de entrenamiento.</p>
        </div>
        <Link href="/services">
          Explorar servicios <ArrowRight size={15} />
        </Link>
      </div>
    )
  }

  return (
    <div className="dashboard-appointment">
      <div className="appointment-icon">
        <CalendarCheck size={21} />
      </div>
      <div className="appointment-info">
        <span>TU PRÓXIMA RESERVA</span>
        <b>{booking.service}</b>
        <small>
          {formatDate(booking.date)}, {booking.time} <i>·</i> Sede {booking.sede}
        </small>
      </div>
      <div className="appointment-count">
        <b>{formatMoney(booking.amount)}</b>
        <small>
          {booking.category === 'canchas'
            ? 'Cancha completa'
            : `${booking.attendees} ${booking.attendees === 1 ? 'asistente' : 'asistentes'}`}
        </small>
      </div>
      <button
        type="button"
        className="appointment-arrow"
        aria-label="Ver pase de acceso"
        onClick={() => onOpenQR(booking)}
      >
        <QrCode size={19} />
      </button>
    </div>
  )
}
