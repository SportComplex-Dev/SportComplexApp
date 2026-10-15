import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosVoucherModal } from './PosVoucherModal'
import type { Booking } from '@sportcomplex/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const confirmedBooking: Booking = {
  id: 'b-1',
  code: 'RS-2026-0001',
  client: 'Carlos Santana',
  category: 'canchas',
  service: 'Cancha Sintética 7',
  sede: 'Norte',
  date: '2026-10-20',
  time: '18:00 - 19:00',
  attendees: 14,
  amount: 140000,
  status: 'Confirmada',
  paymentStatus: 'Aprobada',
  transactionRef: 'pi_1234567890abcdef',
}

test('PosVoucherModal: renders success voucher with booking data', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal
      booking={confirmedBooking}
      sellerName="Andrés Muñoz"
      receiptQrUrl="data:image/png;base64,mockqr"
      onPrint={noop}
      onNextSale={noop}
    />,
  )

  assert.ok(html.includes('¡Venta Exitosa en Mostrador!'), 'Debe celebrar la venta exitosa')
  assert.ok(html.includes('RS-2026-0001'), 'Debe mostrar el código de la reserva')
  assert.ok(html.includes('Carlos Santana'), 'Debe mostrar el titular')
  assert.ok(html.includes('Andrés Muñoz'), 'Debe mostrar el vendedor')
  assert.ok(html.includes('Imprimir Comprobante'), 'Debe ofrecer imprimir el comprobante')
  assert.ok(html.includes('Nueva Venta'), 'Debe ofrecer iniciar una nueva venta')
})

test('PosVoucherModal: shows QR access code when available', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal
      booking={confirmedBooking}
      receiptQrUrl="data:image/png;base64,mockqr"
      onPrint={noop}
      onNextSale={noop}
    />,
  )

  assert.ok(html.includes('QR de acceso RS-2026-0001'), 'Debe exponer el QR de acceso')
})

test('PosVoucherModal: waits for payment confirmation without QR', () => {
  const pending: Booking = { ...confirmedBooking, status: 'Pendiente', paymentStatus: 'Pendiente' }
  const html = renderToStaticMarkup(
    <PosVoucherModal
      booking={pending}
      receiptQrUrl={null}
      onPrint={noop}
      onNextSale={noop}
    />,
  )

  assert.ok(html.includes('Venta en Proceso en Mostrador'), 'Debe indicar venta en proceso')
  assert.ok(
    html.includes('Esperando confirmación de pago'),
    'Debe pedir espera de la confirmación de pago',
  )
})
