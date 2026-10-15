import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PaymentMethodSelector } from './PaymentMethodSelector'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

test('PaymentMethodSelector: prompts to select service and schedule when reservationId is null', () => {
  const html = renderToStaticMarkup(<PaymentMethodSelector reservationId={null} />)

  assert.ok(html.includes('Pago con tarjeta'), 'Debe mostrar el encabezado de pago con tarjeta')
  assert.ok(
    html.includes('Primero selecciona el servicio y el horario'),
    'Debe pedir seleccionar servicio y horario antes de preparar el pago',
  )
  assert.ok(html.includes('role="status"'), 'El aviso debe exponerse como status accesible')
})

test('PaymentMethodSelector: shows preparing state when reservation exists (SSR has no intent yet)', () => {
  const html = renderToStaticMarkup(
    <PaymentMethodSelector reservationId="res-123" onPaymentSuccess={() => {}} />,
  )

  assert.ok(html.includes('Pago con tarjeta'), 'Debe mostrar el encabezado de pago con tarjeta')
  assert.ok(
    html.includes('Preparando el pago seguro de tu reserva'),
    'Sin intent del servidor debe mostrar estado de preparación',
  )
  assert.ok(
    html.includes('Stripe y no se guardan en'),
    'Debe incluir la nota de privacidad de Stripe',
  )
})

test('PaymentMethodSelector: renders card tab panel semantics', () => {
  const html = renderToStaticMarkup(<PaymentMethodSelector reservationId={null} />)

  assert.ok(html.includes('role="tabpanel"'), 'Debe exponer el panel de pago como tabpanel')
  assert.ok(
    html.includes('payment-panel-card'),
    'El panel debe identificarse con el método de tarjeta',
  )
})
