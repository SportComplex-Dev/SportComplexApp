'use client'

import { ArrowRight, Download, QrCode } from 'lucide-react'
import { formatDate, formatMoney } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { AccessWindowIndicator } from '../passes/AccessWindowIndicator'
import { ReceiptPdfLink } from '../passes/ReceiptPdfLink'
import type { PortalTicket } from '../../utils/portal-utils'

interface TicketListItemProps {
  booking: PortalTicket
  downloadingId: string | null
  onOpenQR: (booking: PortalTicket) => void
  onDownloadQR: (booking: PortalTicket) => void
  onSelectCode: (code: string) => void
}

export function TicketListItem({
  booking,
  downloadingId,
  onOpenQR,
  onDownloadQR,
  onSelectCode,
}: TicketListItemProps) {
  const isConfirmed = booking.status === 'Confirmada'

  return (
    <div className="portal-ticket-item">
      <div className="portal-ticket-info">
        <div className="flex items-center gap-2.5">
          <b className="text-base tracking-tight">{booking.service}</b>
          <Badge
            variant={
              booking.status === 'Confirmada'
                ? 'success'
                : booking.status === 'Usada'
                ? 'secondary'
                : 'destructive'
            }
            className="text-[11px] px-2 py-0.5 shrink-0"
          >
            {booking.status}
          </Badge>
        </div>
        {booking.status === 'Confirmada' && (
          <AccessWindowIndicator
            compact
            date={booking.date}
            time={booking.time}
            accessWindowStart={booking.accessWindowStart}
            accessWindowEnd={booking.accessWindowEnd}
          />
        )}
        <span className="text-xs text-[var(--subtle)] flex flex-wrap items-center gap-2 mt-1">
          <span>
            <strong className="text-[var(--ink)] font-semibold">{booking.code}</strong>
          </span>
          <span>·</span>
          <span>
            {formatDate(booking.date)}, {booking.time}
          </span>
          <span>·</span>
          <span>Sede {booking.sede}</span>
          <span>·</span>
          <span>{formatMoney(booking.amount)} COP</span>
        </span>
      </div>

      <div className="portal-ticket-actions">
        {isConfirmed ? (
          <>
            <button
              type="button"
              onClick={() => onOpenQR(booking)}
              className="action-button text-xs py-2 px-3.5 gap-2"
            >
              <QrCode size={15} /> Ver QR de Acceso
            </button>
            <button
              type="button"
              onClick={() => onDownloadQR(booking)}
              disabled={downloadingId === booking.id}
              className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
              title="Descargar imagen QR transferible (PNG)"
            >
              <Download size={14} /> Descargar QR
            </button>
            <ReceiptPdfLink reservaId={booking.id} />
            <a
              href="/confirmation"
              onClick={() => onSelectCode(booking.code)}
              className="calendar-shortcut text-xs py-2 px-3 inline-flex items-center gap-1"
            >
              Pase Digital <ArrowRight size={13} />
            </a>
          </>
        ) : (
          <>
            <ReceiptPdfLink reservaId={booking.id} />
            <a
              href="/services"
              className="calendar-shortcut text-xs py-2 px-3 inline-flex items-center gap-1"
            >
              Reservar de nuevo <ArrowRight size={13} />
            </a>
          </>
        )}
      </div>
    </div>
  )
}
