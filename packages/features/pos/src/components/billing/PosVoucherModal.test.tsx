import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosVoucherModal } from './PosVoucherModal'
import type { Booking } from '@sportcomplex/core'
import type { TicketComprobanteInput } from '@sportcomplex/printing'
import type { ThermalPrinter, ThermalPrinterStatus } from '../../hooks/useThermalPrinter'

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

const comprobante: TicketComprobanteInput = {
  membrete: { entidad: 'Akros Latam', nit: null, direccion: null, telefono: null, correo: null, pie: null },
  emision: { generadoEn: '2026-10-20T15:00:00.000Z' },
  reserva: {
    id: '0b1c2d3e-0000-4000-8000-000000000001',
    estado: 'CONFIRMADA',
    canal: 'TAQUILLA',
    cantidadCupos: 1,
    subtotal: '140000.00',
    descuentoPct: '0.00',
    total: '140000.00',
  },
  servicio: { nombre: 'Cancha Sintética 7', modalidad: 'EXCLUSIVA', fecha: '2026-10-20', horaInicio: '18:00:00', horaFin: '19:00:00' },
  titular: { nombre: 'Carlos Santana' },
  ticket: { id: 'ffeeddcc-0000-4000-8000-000000000000', estado: 'EMITIDO' },
  qr: { payload: 'SC1:ffeeddcc-0000-4000-8000-000000000000:' + 'a'.repeat(64) },
}

function printer(status: ThermalPrinterStatus, over: Partial<ThermalPrinter> = {}): ThermalPrinter {
  return {
    status,
    transport: status === 'lista' ? 'bluetooth' : null,
    available: status === 'no-soportado' ? [] : ['bluetooth', 'usb'],
    deviceName: status === 'lista' ? 'PrinterLE_55E9' : null,
    error: null,
    pair: async () => {},
    print: async () => true,
    ...over,
  }
}

test('PosVoucherModal: renders success voucher with booking data', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal
      booking={confirmedBooking}
      sellerName="Andrés Muñoz"
      comprobante={comprobante}
      printer={printer('lista')}
      onNextSale={noop}
    />,
  )

  assert.ok(html.includes('¡Venta Exitosa en Mostrador!'), 'Debe celebrar la venta exitosa')
  assert.ok(html.includes('RS-2026-0001'), 'Debe mostrar el código de la reserva')
  assert.ok(html.includes('Carlos Santana'), 'Debe mostrar el titular')
  assert.ok(html.includes('Andrés Muñoz'), 'Debe mostrar el vendedor')
  assert.ok(html.includes('Nueva Venta'), 'Debe ofrecer iniciar una nueva venta')
  assert.ok(!html.includes('NIT 901.458.789-2'), 'El membrete viene del servidor, no hardcodeado')
})

test('PosVoucherModal: con impresora emparejada ofrece imprimir el ticket térmico y el PDF de taquilla', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal booking={confirmedBooking} comprobante={comprobante} printer={printer('lista')} onNextSale={noop} />,
  )

  assert.ok(html.includes('Vista previa del ticket'), 'Debe mostrar la vista previa 1:1')
  assert.ok(html.includes('id="btn-print-ticket"'), 'Debe ofrecer imprimir en la térmica')
  assert.ok(html.includes('PrinterLE_55E9'))
  assert.ok(html.includes('(Bluetooth)'), 'Debe indicar el medio de la impresora')
  assert.ok(html.includes('Usar USB'), 'Debe permitir cambiar a una impresora USB')
  assert.ok(
    html.includes(`/api/pdf/receipt/file?reservaId=${comprobante.reserva.id}&amp;destinatario=POS`),
    'Debe ofrecer el PDF de taquilla como respaldo',
  )
})

test('PosVoucherModal: sin impresora emparejada ofrece emparejar por Bluetooth o USB', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal booking={confirmedBooking} comprobante={comprobante} printer={printer('sin-emparejar')} onNextSale={noop} />,
  )

  assert.ok(html.includes('id="btn-pair-printer-bluetooth"'))
  assert.ok(html.includes('id="btn-pair-printer-usb"'))
  assert.ok(!html.includes('id="btn-print-ticket"'))
})

test('PosVoucherModal: solo ofrece los medios que soporta el navegador', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal
      booking={confirmedBooking}
      comprobante={comprobante}
      printer={printer('sin-emparejar', { available: ['usb'] })}
      onNextSale={noop}
    />,
  )

  assert.ok(html.includes('id="btn-pair-printer-usb"'))
  assert.ok(!html.includes('id="btn-pair-printer-bluetooth"'))
})

test('PosVoucherModal: navegador sin Web Bluetooth avisa y deja solo el PDF', () => {
  const html = renderToStaticMarkup(
    <PosVoucherModal booking={confirmedBooking} comprobante={comprobante} printer={printer('no-soportado')} onNextSale={noop} />,
  )

  assert.ok(html.includes('Chrome o Edge'))
  assert.ok(html.includes('id="btn-download-ticket-pdf"'))
  assert.ok(!html.includes('id="btn-print-ticket"'))
})

test('PosVoucherModal: waits for payment confirmation without QR', () => {
  const pending: Booking = { ...confirmedBooking, status: 'Pendiente', paymentStatus: 'Pendiente' }
  const html = renderToStaticMarkup(
    <PosVoucherModal booking={pending} comprobante={null} printer={printer('lista')} onNextSale={noop} />,
  )

  assert.ok(html.includes('Venta en Proceso en Mostrador'), 'Debe indicar venta en proceso')
  assert.ok(html.includes('Esperando confirmación de pago'), 'Debe pedir espera de la confirmación de pago')
  assert.ok(!html.includes('id="btn-print-ticket"'), 'Sin pase emitido no se imprime')
})
