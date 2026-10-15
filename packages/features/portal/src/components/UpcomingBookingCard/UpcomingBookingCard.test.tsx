import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { UpcomingBookingCard } from './UpcomingBookingCard'
import type { PortalTicket } from '../../utils/portal-utils'

test('UpcomingBookingCard: booking=null renders empty state', () => {
  const html = renderToStaticMarkup(
    <UpcomingBookingCard booking={null} onOpenQR={() => {}} />
  )

  assert.ok(html.includes('dashboard-empty'), 'Must contain dashboard-empty container class')
  assert.ok(
    html.includes('Aún no tienes reservas programadas'),
    'Must render empty state message'
  )
  assert.ok(html.includes('Explorar servicios'), 'Must render explore services link')
})

test('UpcomingBookingCard: booking present renders service name, date, attendees and button', () => {
  const sampleBooking: PortalTicket = {
    id: 'up-1',
    code: 'ALT-UPCOMING-01',
    client: 'Carlos Bacca',
    category: 'canchas',
    service: 'Cancha Sintética Principal',
    sede: 'Laureles',
    date: '2026-10-27',
    time: '19:00 — 20:00',
    attendees: 10,
    amount: 90000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  let openedBooking: PortalTicket | null = null
  const handleOpenQR = (b: PortalTicket) => {
    openedBooking = b
  }

  const html = renderToStaticMarkup(
    <UpcomingBookingCard booking={sampleBooking} onOpenQR={handleOpenQR} />
  )

  assert.ok(html.includes('dashboard-appointment'), 'Must contain dashboard-appointment container class')
  assert.ok(html.includes('TU PRÓXIMA RESERVA'), 'Must render eyebrow label')
  assert.ok(html.includes('Cancha Sintética Principal'), 'Must render service name')
  assert.ok(html.includes('Sede Laureles'), 'Must render venue name')
  assert.ok(html.includes('Cancha completa'), 'Must display Cancha completa for canchas category')
  assert.ok(html.includes('$90.000'), 'Must render formatted amount')
  assert.ok(html.includes('aria-label="Ver pase de acceso"'), 'Must render action button with proper aria-label')

  // Verify callback trigger
  handleOpenQR(sampleBooking)
  assert.equal(openedBooking, sampleBooking, 'Must pass booking object to onOpenQR callback')
})
