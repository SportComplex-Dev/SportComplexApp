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
  onProcessPayment: noop,
  onGenerateAltLink: noop,
}

test('PosPaymentStripe: renders totals and charge actions', () => {
  const html = renderToStaticMarkup(<PosPaymentStripe {...baseProps} />)

  assert.ok(html.includes('Cobro Stripe (Cashless)'), 'Debe mostrar el título de cobro')
  assert.ok(html.includes('TOTAL A COBRAR'), 'Debe mostrar el total a cobrar')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el servicio en el desglose')
  assert.ok(html.includes('Cobrar con Tarjeta Stripe'), 'Debe ofrecer el cobro con tarjeta')
  assert.ok(html.includes('Enlace Alternativo'), 'Debe ofrecer el enlace alternativo')
  assert.ok(html.includes('Cero Efectivo'), 'Debe mostrar el badge cashless')
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
