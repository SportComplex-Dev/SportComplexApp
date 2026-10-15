import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalQrModal } from './PortalQrModal'
import type { PortalTicket } from '../../utils/portal-utils'

test('PortalQrModal: open=false or ticket=null returns empty/null markup', () => {
  const sampleTicket: PortalTicket = {
    id: 't-123',
    code: 'ALT-QR-123',
    client: 'Mariana Pajón',
    category: 'canchas',
    service: 'Pista BMX Techada',
    sede: 'Laureles',
    date: '2026-10-30',
    time: '09:00 a. m. — 10:00 a. m.',
    attendees: 1,
    amount: 50000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  const closedHtml = renderToStaticMarkup(
    <PortalQrModal
      ticket={sampleTicket}
      open={false}
      onClose={() => {}}
      onPrint={() => {}}
    />
  )
  assert.equal(closedHtml, '', 'Must render empty markup when open=false')

  const nullTicketHtml = renderToStaticMarkup(
    <PortalQrModal
      ticket={null}
      open={true}
      onClose={() => {}}
      onPrint={() => {}}
    />
  )
  assert.equal(nullTicketHtml, '', 'Must render empty markup when ticket=null')
})

test('PortalQrModal: open=true with ticket renders modal with code, service and actions', () => {
  const sampleTicket: PortalTicket = {
    id: 't-123',
    code: 'ALT-QR-123',
    client: 'Mariana Pajón',
    category: 'canchas',
    service: 'Pista BMX Techada',
    sede: 'Laureles',
    date: '2026-10-30',
    time: '09:00 a. m. — 10:00 a. m.',
    attendees: 2,
    amount: 50000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  const html = renderToStaticMarkup(
    <PortalQrModal
      ticket={sampleTicket}
      open={true}
      onClose={() => {}}
      onPrint={() => {}}
    />
  )

  assert.ok(html.includes('PASE DE ACCESO DIGITAL'), 'Must render digital pass eyebrow')
  assert.ok(html.includes('Pista BMX Techada'), 'Must render service name')
  assert.ok(html.includes('ALT-QR-123'), 'Must render ticket code')
  assert.ok(html.includes('Mariana Pajón'), 'Must render client name')
  assert.ok(html.includes('Imprimir / PDF'), 'Must render print/PDF button action')
  assert.ok(html.includes('Cerrar'), 'Must render close button action')
  assert.ok(html.includes('Pase transferible sin biometría'), 'Must render turnstile instruction')
})
