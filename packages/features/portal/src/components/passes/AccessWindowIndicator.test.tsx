import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AccessWindowIndicator } from './AccessWindowIndicator'

test('AccessWindowIndicator: renders status HABILITADO with ACCESO HABILITADO badge', () => {
  const html = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="08:00 a. m. — 09:00 a. m."
      status="HABILITADO"
    />
  )
  assert.ok(html.includes('ACCESO HABILITADO'), 'Must render ACCESO HABILITADO label')
  assert.ok(html.includes('border-emerald-300'), 'Must contain active emerald badge class')
  assert.ok(html.includes('08:00 - 09:00'), 'Must display entry window label')
})

test('AccessWindowIndicator: renders status ANTICIPADO and EXPIRADO appropriately', () => {
  const anticipadoHtml = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="14:00 — 15:00"
      status="ANTICIPADO"
    />
  )
  assert.ok(anticipadoHtml.includes('Franja Próxima'), 'Must render Franja Próxima for ANTICIPADO')
  assert.ok(anticipadoHtml.includes('border-amber-300'), 'Must contain amber badge class')

  const expiradoHtml = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="10:00 — 11:00"
      status="EXPIRADO"
    />
  )
  assert.ok(expiradoHtml.includes('Franja Vencida'), 'Must render Franja Vencida for EXPIRADO')
  assert.ok(expiradoHtml.includes('border-rose-300'), 'Must contain rose badge class')
  assert.ok(expiradoHtml.includes('El boleto permanece EMITIDO'), 'Must show expired hint')
})

test('AccessWindowIndicator: behavior when accessWindowStart / accessWindowEnd is provided vs omitted', () => {
  // Provided explicitly
  const explicitHtml = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="10:00 a. m. — 11:00 a. m."
      accessWindowStart="09:45:00"
      accessWindowEnd="11:15:00"
      status="HABILITADO"
    />
  )
  assert.ok(explicitHtml.includes('09:45 - 11:15'), 'Must prioritize explicit access window start and end')

  // Omitted - falls back to parsing time string
  const implicitHtml = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="07:00 a. m. — 08:00 a. m."
      status="HABILITADO"
    />
  )
  assert.ok(implicitHtml.includes('07:00 - 08:00'), 'Must parse window from ticket.time string')

  // Invalid time string without explicit window returns empty/null
  const invalidHtml = renderToStaticMarkup(
    <AccessWindowIndicator
      date="2026-10-15"
      time="horario-desconocido"
      status="HABILITADO"
    />
  )
  assert.equal(invalidHtml, '', 'Returns empty when time cannot be parsed and windows omitted')
})
