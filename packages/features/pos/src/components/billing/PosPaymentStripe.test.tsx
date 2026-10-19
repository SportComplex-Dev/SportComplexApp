import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosPaymentStripe } from './PosPaymentStripe'
import type { CatalogItem } from '@sportcomplex/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const service: CatalogItem = {
  id: 'svc-1',
  name: 'Cancha Sintética 7',
  category: 'canchas',
  sede: 'Norte',
  description: 'Cancha sintética de fútbol 7.',
  price: 140000,
  capacity: 14,
  status: 'Disponible',
}

const baseProps = {
  currentService: service,
  subtotalBruto: 140000,
  descuentoMonto: 0,
  subtotalNeto: 117647,
  ivaMonto: 22353,
  totalFinal: 140000,
  isMember: false,
  isProcessing: false,
  processStep: '',
  isTestMode: true,
  onGenerateAltLink: noop,
}

test('PosPaymentStripe: renders totals and charge actions', () => {
  const html = renderToStaticMarkup(<PosPaymentStripe {...baseProps} />)

  assert.ok(html.includes('Cobro Stripe (Cashless)'), 'Debe mostrar el título de cobro')
  assert.ok(html.includes('TOTAL A COBRAR'), 'Debe mostrar el total a cobrar')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el servicio en el desglose')
  assert.ok(html.includes('Cobrar con QR'), 'Debe ofrecer el cobro con QR desde el celular')
  assert.equal(html.match(/<button/g)?.length, 1, 'Debe haber un único botón de cobro')
  assert.ok(!html.includes('Cobrar con tarjeta'), 'No debe ofrecer el datáfono virtual')
  assert.ok(html.includes('no se realizan cobros reales'), 'Debe aclarar que es el modo de pruebas')
  assert.ok(!html.includes('Contactless'), 'No debe prometer un datáfono físico')
  assert.ok(html.includes('Cero Efectivo'), 'Debe mostrar el badge cashless')
})

test('PosPaymentStripe: sin modo test no muestra el aviso de pruebas', () => {
  const html = renderToStaticMarkup(<PosPaymentStripe {...baseProps} isTestMode={false} />)

  assert.ok(!html.includes('no se realizan cobros reales'))
  assert.ok(html.includes('id="btn-pos-alt-link"'))
})

test('PosPaymentStripe: shows member discount line when isMember', () => {
  const html = renderToStaticMarkup(
    <PosPaymentStripe {...baseProps} isMember={true} descuentoMonto={42000} />,
  )

  assert.ok(html.includes('Descuento Socio (30%)'), 'Debe desglosar el descuento de socio')
})

test('PosPaymentStripe: shows processing step while charging', () => {
  const html = renderToStaticMarkup(
    <PosPaymentStripe {...baseProps} isProcessing={true} processStep="Confirmando con Stripe..." />,
  )

  assert.ok(
    html.includes('Confirmando con Stripe...'),
    'Debe mostrar el paso de procesamiento en curso',
  )
  assert.ok(html.includes('disabled'), 'Los botones deben deshabilitarse durante el cobro')
})

test('PosPaymentStripe: disables charge without a selected service', () => {
  const html = renderToStaticMarkup(
    <PosPaymentStripe {...baseProps} currentService={undefined} />,
  )

  assert.ok(html.includes('disabled'), 'Sin servicio no debe permitir cobrar')
})
