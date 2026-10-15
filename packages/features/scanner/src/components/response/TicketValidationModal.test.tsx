import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketValidationModal } from './TicketValidationModal'
import type { RedeemTicketResponse, ScannedTicket } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const detailTicket: NonNullable<RedeemTicketResponse['ticket']> = {
  id: 'ticket-001',
  reservaId: 'reserva-123',
  estado: 'USADO',
  servicioId: 7,
  servicioNombre: 'Cancha Sintética 7',
  fecha: '2026-10-20',
  horaInicio: '18:00:00',
  horaFin: '19:00:00',
  titularId: 'user-1',
  titularNombre: 'Carlos Cliente',
}

const baseProps = {
  employeeName: 'Ana Operadora',
  onClose: () => {},
  onRedeem: () => {},
  onScanNext: () => {},
}

function scannedWith(result: RedeemTicketResponse): ScannedTicket {
  return { ticketId: 'ticket-001', signature: 'aa'.repeat(32), result }
}

test('TicketValidationModal: renders nothing when closed', () => {
  const html = renderToStaticMarkup(
    <TicketValidationModal
      isOpen={false}
      state="ticket-valid"
      ticket={scannedWith({ access: 'GRANTED' })}
      message="msg"
      {...baseProps}
    />
  )

  assert.equal(html, '', 'Debe retornar vacío cuando isOpen es false')
})

test('TicketValidationModal: ticket-valid shows redeem action', () => {
  const html = renderToStaticMarkup(
    <TicketValidationModal
      isOpen={true}
      state="ticket-valid"
      ticket={scannedWith({ access: 'GRANTED' })}
      message="Firma QR válida, lista para canje"
      {...baseProps}
    />
  )

  assert.ok(html.includes('QR listo para canje'), 'Debe mostrar título de QR listo')
  assert.ok(html.includes('Dar Acceso'), 'Debe incluir botón de canje')
  assert.ok(html.includes('ticket-001'), 'Debe mostrar el identificador del ticket')
})

test('TicketValidationModal: access-granted shows holder and next-scan action', () => {
  const html = renderToStaticMarkup(
    <TicketValidationModal
      isOpen={true}
      state="access-granted"
      ticket={scannedWith({ access: 'GRANTED', resultado: 'CONCEDIDO', ticket: detailTicket })}
      message="Acceso registrado correctamente"
      {...baseProps}
    />
  )

  assert.ok(html.includes('Acceso Concedido'), 'Debe mostrar título de acceso concedido')
  assert.ok(html.includes('Carlos Cliente'), 'Debe mostrar el titular del ticket')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el servicio reservado')
  assert.ok(html.includes('Escanear siguiente'), 'Debe permitir escanear el siguiente')
})

test('TicketValidationModal: access-denied shows denial code and message', () => {
  const html = renderToStaticMarkup(
    <TicketValidationModal
      isOpen={true}
      state="access-denied"
      ticket={scannedWith({ access: 'DENIED', resultado: 'DENEGADO_USADO', code: 'ALREADY_USED' })}
      message="Boleto ya utilizado"
      {...baseProps}
    />
  )

  assert.ok(html.includes('Acceso denegado'), 'Debe mostrar título de acceso denegado')
  assert.ok(html.includes('ALREADY_USED'), 'Debe mostrar el código de denegación')
  assert.ok(html.includes('Boleto ya utilizado'), 'Debe mostrar el mensaje de denegación')
})

test('TicketValidationModal: offline ticket-valid suspends redeem', () => {
  const html = renderToStaticMarkup(
    <TicketValidationModal
      isOpen={true}
      state="ticket-valid"
      ticket={scannedWith({ access: 'GRANTED' })}
      message="Firma válida"
      isOnline={false}
      {...baseProps}
    />
  )

  assert.ok(html.includes('offline-modal-alert'), 'Debe mostrar alerta offline')
  assert.ok(html.includes('Canje suspendido'), 'Debe indicar canje suspendido sin conexión')
  assert.ok(html.includes('disabled=""'), 'El botón de canje debe deshabilitarse sin conexión')
})
