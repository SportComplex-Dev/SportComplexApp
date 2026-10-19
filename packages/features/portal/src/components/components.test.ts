import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  TicketQrModal,
  QRGraphicHD,
  ReceiptPdfLink,
  AccessWindowIndicator,
  PortalBookingsList,
  UpcomingBookingCard,
  CategoryShowcase,
  categoryIcons,
  IconBox,
} from './index'

import {
  formatSlotTime,
  clasificarReservas,
  obtenerProximaReserva,
  calcularDesgloseComprobante,
  generarQRDataUrl,
  obtenerSaludoContextual,
  sanitizeFilename,
  type PortalTicket,
} from '../utils/portal-utils'

test('packages/features/portal exports all core portal components and utilities', () => {
  assert.equal(typeof TicketQrModal, 'function')
  assert.equal(typeof QRGraphicHD, 'function')
  assert.equal(typeof ReceiptPdfLink, 'function')
  assert.equal(typeof AccessWindowIndicator, 'function')
  assert.equal(typeof PortalBookingsList, 'function')
  assert.equal(typeof UpcomingBookingCard, 'function')
  assert.equal(typeof CategoryShowcase, 'function')
  assert.equal(typeof IconBox, 'function')
  assert.ok(categoryIcons)
  assert.ok(categoryIcons.court)
  assert.ok(categoryIcons.pool)
  assert.ok(categoryIcons.gym)
  assert.ok(categoryIcons.wellness)
})

test('portal-utils: formatSlotTime handles standard strings and ISO time parts', () => {
  assert.equal(formatSlotTime('08:00'), '08:00')
  assert.equal(formatSlotTime(undefined), '07:00 a. m.')
  assert.equal(formatSlotTime('2026-10-15T14:30:00Z'), '2:30 p. m.')
  assert.equal(formatSlotTime('2026-10-15T09:15:00Z'), '9:15 a. m.')
})

test('portal-utils: clasificarReservas correctly separates active, history, and cancelled bookings', () => {
  const sampleBookings: PortalTicket[] = [
    {
      id: 'b1',
      code: 'ALT-001',
      client: 'Carlos Perez',
      category: 'canchas',
      service: 'Cancha Sintética 1',
      sede: 'Laureles',
      date: '2026-10-20',
      time: '08:00 a. m. — 09:00 a. m.',
      attendees: 10,
      amount: 80000,
      status: 'Confirmada',
      paymentMethod: 'card',
    },
    {
      id: 'b2',
      code: 'ALT-002',
      client: 'Carlos Perez',
      category: 'piscina',
      service: 'Carril Natación Libre',
      sede: 'Poblado',
      date: '2026-10-10',
      time: '07:00 a. m. — 08:00 a. m.',
      attendees: 1,
      amount: 25000,
      status: 'Usada',
      paymentMethod: 'wompi',
    },
    {
      id: 'b3',
      code: 'ALT-003',
      client: 'Carlos Perez',
      category: 'canchas',
      service: 'Cancha Tenis Polvo de Ladrillo',
      sede: 'Envigado',
      date: '2026-10-05',
      time: '10:00 a. m. — 11:00 a. m.',
      attendees: 2,
      amount: 60000,
      status: 'Cancelada',
      paymentMethod: 'cash',
    },
  ]

  const classified = clasificarReservas(sampleBookings)
  assert.equal(classified.activas.length, 1)
  assert.equal(classified.activas[0]?.id, 'b1')
  assert.equal(classified.historial.length, 1)
  assert.equal(classified.historial[0]?.id, 'b2')
  assert.equal(classified.canceladas.length, 1)
  assert.equal(classified.canceladas[0]?.id, 'b3')
})

test('portal-utils: obtenerProximaReserva picks nearest future confirmed booking', () => {
  const bookings: PortalTicket[] = [
    {
      id: 'past',
      code: 'ALT-PAST',
      client: 'Test',
      category: 'canchas',
      service: 'Cancha 1',
      sede: 'Laureles',
      date: '2026-10-01',
      time: '08:00 a. m. — 09:00 a. m.',
      attendees: 1,
      amount: 50000,
      status: 'Confirmada',
      paymentMethod: 'card',
    },
    {
      id: 'future2',
      code: 'ALT-FUT2',
      client: 'Test',
      category: 'canchas',
      service: 'Cancha 2',
      sede: 'Laureles',
      date: '2026-10-25',
      time: '08:00 a. m. — 09:00 a. m.',
      attendees: 1,
      amount: 50000,
      status: 'Confirmada',
      paymentMethod: 'card',
    },
    {
      id: 'future1',
      code: 'ALT-FUT1',
      client: 'Test',
      category: 'canchas',
      service: 'Cancha 3',
      sede: 'Laureles',
      date: '2026-10-20',
      time: '08:00 a. m. — 09:00 a. m.',
      attendees: 1,
      amount: 50000,
      status: 'Confirmada',
      paymentMethod: 'card',
    },
  ]

  const next = obtenerProximaReserva(bookings, '2026-10-15')
  assert.ok(next)
  assert.equal(next?.id, 'future1')
})

test('portal-utils: calcularDesgloseComprobante calculates 19% IVA accurately', () => {
  const desglose = calcularDesgloseComprobante(119000)
  assert.equal(desglose.total, 119000)
  assert.equal(desglose.subtotal, 100000)
  assert.equal(desglose.iva, 19000)
  assert.ok(desglose.totalFormateado.includes('119'))
})

test('portal-utils: sanitizeFilename cleans invalid filename characters', () => {
  assert.equal(sanitizeFilename('reserva/2026:10*09?'), 'reserva_2026_10_09_')
  assert.equal(sanitizeFilename('ALT-A1B2-C3D4'), 'ALT-A1B2-C3D4')
})

test('portal-utils: obtenerSaludoContextual provides right greetings', () => {
  assert.equal(obtenerSaludoContextual(8), 'Buenos días')
  assert.equal(obtenerSaludoContextual(14), 'Buenas tardes')
  assert.equal(obtenerSaludoContextual(21), 'Buenas noches')
})

test('portal-utils: generarQRDataUrl generates base64 PNG data url', async () => {
  const dataUrl = await generarQRDataUrl('ALT-TEST-PAYLOAD')
  assert.ok(dataUrl.startsWith('data:image/png;base64,'))
})

test('components rendering: UpcomingBookingCard renders empty state and booking state', () => {
  const emptyMarkup = renderToStaticMarkup(
    React.createElement(UpcomingBookingCard, { booking: null, onOpenQR: () => {} })
  )
  assert.ok(emptyMarkup.includes('Aún no tienes reservas programadas'))

  const sampleTicket: PortalTicket = {
    id: 'b1',
    code: 'ALT-100',
    client: 'Ana Gomez',
    category: 'canchas',
    service: 'Cancha Sintética Premium',
    sede: 'Laureles',
    date: '2026-10-20',
    time: '08:00 a. m. — 09:00 a. m.',
    attendees: 10,
    amount: 90000,
    status: 'Confirmada',
    paymentMethod: 'card',
  }

  const bookingMarkup = renderToStaticMarkup(
    React.createElement(UpcomingBookingCard, { booking: sampleTicket, onOpenQR: () => {} })
  )
  assert.ok(bookingMarkup.includes('Cancha Sintética Premium'))
  assert.ok(bookingMarkup.includes('TU PRÓXIMA RESERVA'))
})

test('components rendering: ReceiptPdfLink descarga el PDF del portal, no imprime', () => {
  const markup = renderToStaticMarkup(React.createElement(ReceiptPdfLink, { reservaId: 'res 1' }))
  assert.ok(markup.includes('href="/api/pdf/receipt/file?reservaId=res%201&amp;destinatario=PORTAL"'))
  assert.ok(markup.includes('download'))
  assert.ok(!markup.includes('destinatario=POS'), 'El cliente nunca pide el comprobante de taquilla')
})

test('components rendering: IconBox renders icon with tone class', () => {
  const markup = renderToStaticMarkup(
    React.createElement(IconBox, { icon: categoryIcons.court, tone: 'emerald' })
  )
  assert.ok(markup.includes('tone-emerald'))
  assert.ok(markup.includes('icon-box'))
})
