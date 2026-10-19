import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosAltLinkModal } from './PosAltLinkModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const baseProps = {
  isOpen: true,
  onClose: noop,
  altLinkUrl: 'https://pay.sportcomplex.test/c/res-123',
  altLinkQrUrl: 'data:image/png;base64,mockqr',
  copiedLink: false,
  onCopyLink: noop,
}

test('PosAltLinkModal: returns null when closed', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} isOpen={false} />)

  assert.equal(html, '', 'Debe retornar vacío cuando el modal está cerrado')
})

test('PosAltLinkModal: renders QR, URL and copy action when open', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} />)

  assert.ok(html.includes('Cobro con QR'), 'Debe mostrar el título del modal')
  assert.ok(
    html.includes('https://pay.sportcomplex.test/c/res-123'),
    'Debe exponer la URL del enlace alternativo',
  )
  assert.ok(html.includes('QR para pago móvil alternativo'), 'Debe mostrar el QR de pago móvil')
  assert.ok(html.includes('Copiar'), 'Debe ofrecer copiar el enlace')
  assert.ok(html.includes('aria-label="Cerrar modal"'), 'Debe incluir cierre accesible')
})

test('PosAltLinkModal: mientras espera el pago muestra el estado y permite cancelar', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} waiting={true} />)

  assert.ok(html.includes('Esperando el pago del cliente'), 'Debe indicar que espera el pago')
  assert.ok(html.includes('Cancelar cobro'), 'Cerrar debe leerse como cancelar el cobro')
  assert.ok(!html.includes('4242'), 'Sin modo test no muestra la tarjeta de prueba')
})

test('PosAltLinkModal: en modo test muestra la tarjeta de prueba para la demo', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} testMode={true} />)

  assert.ok(html.includes('4242 4242 4242 4242'), 'Debe mostrar la tarjeta de prueba de Stripe')
  assert.ok(html.includes('sin cobros reales'))
  assert.ok(html.includes('Cerrar'), 'Sin espera, el botón solo cierra')
})

test('PosAltLinkModal: shows copied confirmation state', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} copiedLink={true} />)

  assert.ok(html.includes('Copiado'), 'Debe confirmar que el enlace fue copiado')
})

test('PosAltLinkModal: omits QR block without qr url', () => {
  const html = renderToStaticMarkup(<PosAltLinkModal {...baseProps} altLinkQrUrl={null} />)

  assert.ok(
    !html.includes('QR para pago móvil alternativo'),
    'Sin QR no debe mostrar el bloque de escaneo',
  )
  assert.ok(
    html.includes('https://pay.sportcomplex.test/c/res-123'),
    'Debe mantener la URL copiable sin QR',
  )
})
