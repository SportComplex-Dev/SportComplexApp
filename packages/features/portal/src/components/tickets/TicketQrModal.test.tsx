import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TicketQrModal } from './TicketQrModal'
import type { PortalTicket } from '../../utils/portal-utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const mockTicket: PortalTicket = {
  id: 'ticket-qr-001',
  code: 'TK-FUTBOL-99',
  qrPayload: 'SC1:ticket-qr-001:999888777666555444333222111000aaabbbcccdddeeefff',
  qrDataUrl: 'data:image/png;base64,mockPngDataUrl',
  service: 'Cancha Sintética 7',
  category: 'canchas',
  sede: 'Norte',
  date: '2026-10-25',
  time: '18:00 - 19:00',
  attendees: 14,
  amount: 140000,
  status: 'Confirmada',
  client: 'Carlos Cliente',
  accessWindowStart: '18:00:00',
  accessWindowEnd: '19:00:00',
}

test('TicketQrModal: returns null when ticket is null (closed state)', () => {
  const html = renderToStaticMarkup(
    <TicketQrModal
      ticket={null}
      onClose={() => {}}
    />
  )

  assert.equal(html, '', 'Debe retornar vacío / null cuando no hay tiquete seleccionado')
})

test('TicketQrModal: renders ticket details, QR, access window and actions when open', () => {
  const html = renderToStaticMarkup(
    <TicketQrModal
      ticket={mockTicket}
      onClose={() => {}}
      onDownloadQr={() => {}}
    />
  )

  // Header & Title
  assert.ok(html.includes('PASE DE ACCESO DIGITAL'), 'Debe incluir encabezado de pase de acceso')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el nombre del servicio')
  assert.ok(html.includes('Sede Norte'), 'Debe mostrar la sede')
  assert.ok(html.includes('TK-FUTBOL-99'), 'Debe mostrar el código del tiquete')
  assert.ok(html.includes('Carlos Cliente'), 'Debe mostrar el titular')
  assert.ok(html.includes('14 cupos'), 'Debe mostrar el número de cupos')

  // Close button
  assert.ok(html.includes('aria-label="Cerrar modal de QR"'), 'Debe incluir botón de cerrar accesible')
  assert.ok(html.includes('Cerrar'), 'Debe incluir texto del botón de cierre')

  // Actions
  assert.ok(html.includes('Descargar Imagen QR (PNG)'), 'Debe tener botón de descarga de imagen QR')
  assert.ok(html.includes('Descargar PDF'), 'Debe ofrecer el comprobante en PDF')
  assert.ok(!html.includes('Imprimir'), 'El cliente no imprime: eso es del operador en taquilla')

  // Security hint
  assert.ok(html.includes('Pase transferible sin biometría'), 'Debe incluir leyenda de pase transferible')
})

test('TicketQrModal: disables download while it is in progress', () => {
  const html = renderToStaticMarkup(
    <TicketQrModal
      ticket={mockTicket}
      downloading={true}
      onClose={() => {}}
      onDownloadQr={() => {}}
    />
  )

  assert.ok(html.includes('disabled=""'), 'Los botones deben deshabilitarse durante acciones en curso')
})

test('TicketQrModal: dashboard variant omits PNG download but keeps the PDF', () => {
  const html = renderToStaticMarkup(
    <TicketQrModal
      ticket={mockTicket}
      onClose={() => {}}
    />
  )

  assert.ok(html.includes('Descargar PDF'), 'Debe ofrecer el PDF también en el dashboard')
  assert.ok(!html.includes('Descargar Imagen QR'), 'No debe mostrar descarga cuando se omite onDownloadQr')
})
