import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QrModal, QRGraphicHD } from '../QrModal'
import type { Booking } from '@sportcomplex/core'

test('QRGraphicHD: renders QR graphic container with accessible label and initial dataUrl', () => {
  const dummyDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const html = renderToStaticMarkup(
    <QRGraphicHD code="ALT-CODE-HD" dataUrl={dummyDataUrl} />
  )

  assert.ok(html.includes('qr-modal-hd'), 'Must contain qr-modal-hd container class')
  assert.ok(html.includes('aria-label="Código QR de acceso para ticket ALT-CODE-HD"'), 'Must contain accessible aria-label')
  assert.ok(html.includes('alt="Código QR de acceso ALT-CODE-HD"'), 'Must render image with proper alt')
  assert.ok(html.includes(dummyDataUrl), 'Must render provided dataUrl')
})

test('QrModal: open=false returns empty/null markup', () => {
  const sampleTicket: Booking = {
    id: 'b-open-false',
    code: 'ALT-CLOSE-1',
    client: 'Lucas Vazquez',
    category: 'canchas',
    service: 'Cancha Tenis',
    sede: 'Laureles',
    date: '2026-10-25',
    time: '08:00 a. m.',
    attendees: 2,
    amount: 60000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  const closedHtml = renderToStaticMarkup(
    <QrModal ticket={sampleTicket} open={false} onClose={() => {}} />
  )
  assert.equal(closedHtml, '', 'Must render empty markup when open=false')

  const nullTicketHtml = renderToStaticMarkup(
    <QrModal ticket={null} open={true} onClose={() => {}} />
  )
  assert.equal(nullTicketHtml, '', 'Must render empty markup when ticket=null')
})

test('QrModal: open=true renders modal dialog with ticket details, metadata, and actions', () => {
  const sampleTicket: Booking = {
    id: 'b-open-true',
    code: 'ALT-MODAL-77',
    client: 'Catalina Usme',
    category: 'canchas',
    service: 'Cancha Sintética Profesional',
    sede: 'Laureles',
    date: '2026-10-25',
    time: '19:00 — 20:00',
    attendees: 10,
    amount: 120000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  const html = renderToStaticMarkup(
    <QrModal ticket={sampleTicket} open={true} onClose={() => {}} onPrint={() => {}} />
  )

  assert.ok(html.includes('Pase Digital de Acceso'), 'Must render dialog header')
  assert.ok(html.includes('Cancha Sintética Profesional'), 'Must render service name')
  assert.ok(html.includes('ALT-MODAL-77'), 'Must render code badge')
  assert.ok(html.includes('Sede Laureles'), 'Must render venue location')
  assert.ok(html.includes('10 personas'), 'Must render attendees count')
  assert.ok(html.includes('Descargar Imagen'), 'Must render download action button')
  assert.ok(html.includes('Imprimir Voucher'), 'Must render print action button')
})
