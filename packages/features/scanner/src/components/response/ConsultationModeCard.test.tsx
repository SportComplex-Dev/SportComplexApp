import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConsultationModeCard, OfflineBanner } from './ConsultationModeCard'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

test('ConsultationModeCard: active consultation mode shows informative copy', () => {
  const html = renderToStaticMarkup(
    <ConsultationModeCard isConsultationMode={true} onToggle={() => {}} />
  )

  assert.ok(html.includes('Modo Consulta Informativo'), 'Debe mostrar el título del modo')
  assert.ok(html.includes('Activado'), 'Debe mostrar estado activado')
  assert.ok(html.includes('Puesto asignado: Ninguno'), 'Debe aclarar que no hay puesto asignado')
  assert.ok(html.includes('aria-label="Alternar modo consulta"'), 'El toggle debe ser accesible')
})

test('ConsultationModeCard: shift mode prompts to enable consultation', () => {
  const html = renderToStaticMarkup(
    <ConsultationModeCard isConsultationMode={false} onToggle={() => {}} />
  )

  assert.ok(html.includes('Desactivado'), 'Debe mostrar estado desactivado')
  assert.ok(html.includes('Modo Turno'), 'Debe describir el modo turno')
  assert.ok(html.includes('Modo Consulta'), 'Debe sugerir activar el modo consulta')
})

test('OfflineBanner: warns that redeem is suspended offline', () => {
  const html = renderToStaticMarkup(<OfflineBanner />)

  assert.ok(html.includes('role="alert"'), 'Debe exponerse como alerta')
  assert.ok(html.includes('offline-connectivity-banner'), 'Debe incluir testid del banner offline')
  assert.ok(html.includes('Sin conexión a internet'), 'Debe advertir falta de conexión')
  assert.ok(html.includes('canje de tickets'), 'Debe indicar suspensión del canje')
})
