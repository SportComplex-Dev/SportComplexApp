import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketListItem } from './TicketListItem'
import type { PortalTicket } from '../../utils/portal-utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const mockConfirmedBooking: PortalTicket = {
  id: 'book-conf-101',
  code: 'TK-PADEL-101',
  service: 'Pista de Pádel Panorámica',
  category: 'padel',
  date: '2026-10-30',
  time: '19:00 - 20:30',
  amount: 95000,
  status: 'Confirmada',
  client: 'Ana Cliente',
  attendees: 4,
  sede: 'Campestre',
  accessWindowStart: '19:00:00',
  accessWindowEnd: '20:30:00',
}

const mockUsedBooking: PortalTicket = {
  id: 'book-used-102',
  code: 'TK-GIM-102',
  service: 'Pase Fitness Gimnasio',
  category: 'fitness',
  date: '2026-10-01',
  time: '08:00 - 10:00',
  amount: 35000,
  status: 'Usada',
  client: 'Ana Cliente',
  attendees: 1,
  sede: 'Poblado',
}

const mockCancelledBooking: PortalTicket = {
  id: 'book-canc-103',
  code: 'TK-PISC-103',
  service: 'Piscina Olímpica',
  category: 'acuaticas',
  date: '2026-10-05',
  time: '07:00 - 08:00',
  amount: 25000,
  status: 'Cancelada',
  client: 'Ana Cliente',
  attendees: 1,
  sede: 'Laureles',
}

test('TicketListItem: renders confirmed booking details and full action suite', () => {
  const html = renderToStaticMarkup(
    <TicketListItem
      booking={mockConfirmedBooking}
      downloadingId={null}
      onOpenQR={() => {}}
      onDownloadQR={() => {}}
      onSelectCode={() => {}}
    />
  )

  // Details
  assert.ok(html.includes('Pista de Pádel Panorámica'), 'Debe mostrar el nombre del servicio')
  assert.ok(html.includes('TK-PADEL-101'), 'Debe mostrar el código del tiquete')
  assert.ok(html.includes('19:00 - 20:30'), 'Debe mostrar el horario')
  assert.ok(html.includes('Sede Campestre'), 'Debe mostrar la sede')
  assert.ok(html.includes('Confirmada'), 'Debe mostrar el badge de Confirmada')

  // Actions for confirmed booking
  assert.ok(html.includes('Ver QR de Acceso'), 'Debe renderizar botón para ver QR')
  assert.ok(html.includes('Descargar QR'), 'Debe renderizar botón para descargar QR')
  assert.ok(html.includes('Descargar PDF'), 'Debe ofrecer el comprobante en PDF')
  assert.ok(!html.includes('Imprimir'), 'El cliente no imprime: eso es del operador en taquilla')
  assert.ok(html.includes('Pase Digital'), 'Debe renderizar enlace al pase digital')
  assert.ok(html.includes('/confirmation'), 'Enlace de pase digital debe dirigir a /confirmation')
})

test('TicketListItem: renders past or used booking with re-booking and receipt actions', () => {
  const html = renderToStaticMarkup(
    <TicketListItem
      booking={mockUsedBooking}
      downloadingId={null}
      onOpenQR={() => {}}
      onDownloadQR={() => {}}
      onSelectCode={() => {}}
    />
  )

  assert.ok(html.includes('Pase Fitness Gimnasio'), 'Debe mostrar el servicio usado')
  assert.ok(html.includes('Usada'), 'Debe mostrar el badge Usada')
  assert.ok(html.includes('Descargar PDF'), 'Debe permitir descargar el recibo de reservas pasadas')
  assert.ok(html.includes('Reservar de nuevo'), 'Debe ofrecer enlace para reservar de nuevo')
  assert.ok(html.includes('/services'), 'Enlace debe dirigir a /services')

  // No active QR actions for used booking
  assert.ok(!html.includes('Ver QR de Acceso'), 'NO debe permitir ver QR activo en reserva usada')
  assert.ok(!html.includes('Descargar QR'), 'NO debe permitir descargar QR activo en reserva usada')
})

test('TicketListItem: renders cancelled booking correctly and handles loading states', () => {
  const htmlCancelled = renderToStaticMarkup(
    <TicketListItem
      booking={mockCancelledBooking}
      downloadingId="book-canc-103"
      onOpenQR={() => {}}
      onDownloadQR={() => {}}
      onSelectCode={() => {}}
    />
  )

  assert.ok(htmlCancelled.includes('Cancelada'), 'Debe mostrar badge Cancelada')
  assert.ok(htmlCancelled.includes('destinatario=PORTAL'), 'El recibo de una cancelada también se descarga en PDF')
})
