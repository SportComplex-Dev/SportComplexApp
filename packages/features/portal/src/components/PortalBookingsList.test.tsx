import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalBookingsList } from './PortalBookingsList'
import type { PortalTicket } from '../utils/portal-utils'

test('PortalBookingsList: empty state renders empty message when tickets array is empty', () => {
  const html = renderToStaticMarkup(
    <PortalBookingsList
      activeTab="activas"
      setActiveTab={() => {}}
      activeBookings={[]}
      historyBookings={[]}
      cancelledBookings={[]}
      currentTabItems={[]}
      onOpenQR={() => {}}
      onPrintTicket={() => {}}
      onSelectCode={() => {}}
    />
  )

  assert.ok(html.includes('No hay reservas en esta categoría'), 'Must render empty state header')
  assert.ok(
    html.includes('No cuentas con reservas vigentes en este momento'),
    'Must render active tab empty message'
  )
  assert.ok(html.includes('Explorar catálogo'), 'Must render call to action to catalog')
})

test('PortalBookingsList: renders list of tickets verifying codes, services, dates and amounts', () => {
  const tickets: PortalTicket[] = [
    {
      id: 'b-001',
      code: 'ALT-COURT-91',
      client: 'Santiago Restrepo',
      category: 'canchas',
      service: 'Cancha Pádel Panorámica 1',
      sede: 'Laureles',
      date: '2026-10-25',
      time: '08:00 a. m. — 09:30 a. m.',
      attendees: 4,
      amount: 110000,
      status: 'Confirmada',
      paymentMethod: 'card',
      transactionRef: 'tx_padel_91',
    },
    {
      id: 'b-002',
      code: 'ALT-GYM-44',
      client: 'Santiago Restrepo',
      category: 'gimnasio',
      service: 'Pase Gimnasio Crossfit',
      sede: 'Poblado',
      date: '2026-10-26',
      time: '07:00 a. m. — 08:30 a. m.',
      attendees: 1,
      amount: 35000,
      status: 'Confirmada',
      paymentMethod: 'wompi',
    },
  ]

  const html = renderToStaticMarkup(
    <PortalBookingsList
      activeTab="activas"
      setActiveTab={() => {}}
      activeBookings={tickets}
      historyBookings={[]}
      cancelledBookings={[]}
      currentTabItems={tickets}
      onOpenQR={() => {}}
      onPrintTicket={() => {}}
      onSelectCode={() => {}}
    />
  )

  // Verifies first ticket
  assert.ok(html.includes('ALT-COURT-91'), 'Must render ticket code for first booking')
  assert.ok(html.includes('Cancha Pádel Panorámica 1'), 'Must render service name for first booking')
  assert.ok(html.includes('Sede Laureles'), 'Must render venue for first booking')

  // Verifies second ticket
  assert.ok(html.includes('ALT-GYM-44'), 'Must render ticket code for second booking')
  assert.ok(html.includes('Pase Gimnasio Crossfit'), 'Must render service name for second booking')
  assert.ok(html.includes('Sede Poblado'), 'Must render venue for second booking')

  // Verifies actions
  assert.ok(html.includes('Ver QR de Acceso'), 'Must render QR action button')
  assert.ok(html.includes('PDF'), 'Must render PDF print button')
  assert.ok(html.includes('Pase Digital'), 'Must render digital pass link')
})
