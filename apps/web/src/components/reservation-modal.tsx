'use client'

import { ArrowRight, CalendarCheck, X } from 'lucide-react'
import { formatDate, formatMoney, type CatalogItem } from '@sportcomplex/core'
import { ActionButton } from '@/components/action-button'

export function ReservationModal({
  close,
  proceed,
  item,
  date,
  time,
  attendees,
}: {
  close: () => void
  proceed: () => void
  item: CatalogItem
  date: string
  time: string
  attendees: number
}) {
  const isCourt = item.category === 'canchas'
  const isPrivatePool = item.category === 'piscinas' && item.poolType === 'PRIVADA'
  const total = isCourt || isPrivatePool ? item.price : item.price * attendees

  return (
    <div className="modal-backdrop" role="presentation" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="reservation-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button onClick={close} className="modal-close" aria-label="Cerrar">
          <X size={18} />
        </button>
        <div className="modal-icon">
          <CalendarCheck size={23} />
        </div>
        <div className="eyebrow">RESUMEN DE TU RESERVA</div>
        <h2 id="modal-title">
          ¿Confirmamos<br />tu espacio?
        </h2>
        <p>
          {item.name}
          <br />
          {formatDate(date)} · {time} ·{' '}
          {isCourt
            ? 'Cancha completa'
            : `${attendees} ${attendees === 1 ? 'asistente' : 'asistentes'}`}
        </p>
        <div className="modal-price">
          <span>Total estimado</span>
          <b>
            {formatMoney(total)} <small>COP</small>
          </b>
        </div>
        <ActionButton onClick={proceed} className="w-full justify-center">
          Continuar al pago <ArrowRight size={16} />
        </ActionButton>
        <button onClick={close} className="modal-cancel">
          Seguir explorando
        </button>
      </div>
    </div>
  )
}