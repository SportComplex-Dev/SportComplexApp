import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ManualEntryCard } from './ManualEntryCard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

test('ManualEntryCard: collapsed state shows toggle without form', () => {
  const html = renderToStaticMarkup(
    <ManualEntryCard
      showManualInput={false}
      setShowManualInput={noop as never}
      manualPayload=""
      setManualPayload={noop}
      manualTicketId=""
      setManualTicketId={noop}
      manualSignature=""
      setManualSignature={noop}
      consultationLoading={false}
      onSubmit={(e) => e.preventDefault()}
    />
  )

  assert.ok(html.includes('Ingreso manual'), 'Debe mostrar el encabezado de ingreso manual')
  assert.ok(html.includes('Mostrar'), 'Debe ofrecer mostrar el formulario')
  assert.ok(!html.includes('Payload QR completo'), 'No debe mostrar el formulario colapsado')
})

test('ManualEntryCard: expanded state renders manual fields and submit', () => {
  const html = renderToStaticMarkup(
    <ManualEntryCard
      showManualInput={true}
      setShowManualInput={noop as never}
      manualPayload="SC1:ticket-1:firma"
      setManualPayload={noop}
      manualTicketId="ticket-1"
      setManualTicketId={noop}
      manualSignature={'bb'.repeat(32)}
      consultationLoading={false}
      onSubmit={(e) => e.preventDefault()}
    />
  )

  assert.ok(html.includes('Payload QR completo'), 'Debe incluir campo de payload completo')
  assert.ok(html.includes('Código UUID del Ticket'), 'Debe incluir campo de UUID')
  assert.ok(html.includes('Firma HMAC'), 'Debe incluir campo de firma')
  assert.ok(html.includes('Consultar Tiquete'), 'Debe incluir botón de consulta')
  assert.ok(html.includes('SC1:ticket-1:firma'), 'Debe reflejar el payload ingresado')
})

test('ManualEntryCard: loading state disables submit', () => {
  const html = renderToStaticMarkup(
    <ManualEntryCard
      showManualInput={true}
      setShowManualInput={noop as never}
      manualPayload=""
      setManualPayload={noop}
      manualTicketId=""
      setManualTicketId={noop}
      manualSignature=""
      setManualSignature={noop}
      consultationLoading={true}
      onSubmit={(e) => e.preventDefault()}
    />
  )

  assert.ok(html.includes('Consultando...'), 'Debe mostrar estado de consulta en curso')
  assert.ok(html.includes('disabled'), 'Debe deshabilitar el envío durante la carga')
})
