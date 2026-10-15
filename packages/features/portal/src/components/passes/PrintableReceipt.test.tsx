import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PrintableReceipt } from './PrintableReceipt'
import type { Booking } from '@sportcomplex/core'

test('PrintableReceipt: renders header with AKROS SPORTCOMPLEX and fiscal details', () => {
  const sampleTicket: Booking = {
    id: 'res-777',
    code: 'ALT-RCPT-77',
    client: 'Juan Valdez',
    category: 'canchas',
    service: 'Alquiler Cancha Tenis',
    sede: 'Poblado',
    date: '2026-10-28',
    time: '16:00 — 17:30',
    attendees: 2,
    amount: 119000,
    status: 'Confirmada',
    paymentMethod: 'card',
    transactionRef: 'tx_stripe_999888',
  }

  const html = renderToStaticMarkup(
    <PrintableReceipt ticket={sampleTicket} />
  )

  assert.ok(html.includes('AKROS SPORTCOMPLEX'), 'Must render entity header AKROS SPORTCOMPLEX')
  assert.ok(html.includes('Complejo Deportivo &amp; Wellness Cashless') || html.includes('Complejo Deportivo & Wellness Cashless'), 'Must render subtitle')
  assert.ok(html.includes('COMPROBANTE 58mm · PASE DIGITAL'), 'Must render ticket voucher label')
  assert.ok(html.includes('ALT-RCPT-77'), 'Must render ticket code')
})

test('PrintableReceipt: renders financial breakdown with subtotal, 19% IVA, and total', () => {
  const sampleTicket: Booking = {
    id: 'res-888',
    code: 'ALT-FISCAL-88',
    client: 'Carolina Gomez',
    category: 'canchas',
    service: 'Cancha Squash 1',
    sede: 'Laureles',
    date: '2026-10-29',
    time: '18:00 — 19:00',
    attendees: 2,
    amount: 119000,
    status: 'Confirmada',
    paymentMethod: 'wompi',
    transactionRef: 'wompi_ref_12345',
  }

  const html = renderToStaticMarkup(
    <PrintableReceipt ticket={sampleTicket} />
  )

  // 119000 / 1.19 = 100000 subtotal, 19000 IVA
  assert.ok(html.includes('Subtotal:'), 'Must render Subtotal label')
  assert.ok(html.includes('$100.000'), 'Must render calculated subtotal $100.000')
  assert.ok(html.includes('IVA (19%):'), 'Must render IVA 19% label')
  assert.ok(html.includes('$19.000'), 'Must render calculated IVA $19.000')
  assert.ok(html.includes('TOTAL:'), 'Must render TOTAL label')
  assert.ok(html.includes('$119.000 COP'), 'Must render total formatted amount')
})

test('PrintableReceipt: renders payment method and transaction reference', () => {
  const sampleTicket: Booking = {
    id: 'res-999',
    code: 'ALT-PAY-99',
    client: 'David Ospina',
    category: 'canchas',
    service: 'Cancha Sintética 2',
    sede: 'Envigado',
    date: '2026-10-31',
    time: '20:00 — 21:00',
    attendees: 10,
    amount: 95000,
    status: 'Confirmada',
    paymentMethod: 'credit_card',
    transactionRef: 'ch_stripe_authtoken_xyz',
  }

  const html = renderToStaticMarkup(
    <PrintableReceipt ticket={sampleTicket} />
  )

  assert.ok(html.includes('MÉTODO DE PAGO:'), 'Must render payment method section')
  assert.ok(html.includes('CREDIT_CARD'), 'Must render upper-cased payment method')
  assert.ok(html.includes('REF TRANSACCIÓN:'), 'Must render transaction reference section')
  assert.ok(html.includes('ch_stripe_authtoken_xyz'), 'Must render actual transaction reference')
})
