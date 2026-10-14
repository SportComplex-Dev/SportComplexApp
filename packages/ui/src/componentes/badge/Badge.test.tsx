import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Badge } from './Badge'

;(globalThis as any).React = React

test('Badge (SCRUM-172): Renderiza con variantes semánticas y soporte accesible', () => {
  const html = renderToStaticMarkup(<Badge variant="success">Disponible</Badge>)
  assert.ok(html.includes('bg-[#edf5e2]'), 'Variante success aplica estilos correctos')
  assert.ok(html.includes('Disponible'), 'Renderiza el texto del badge')
})

test('Badge (SCRUM-172): Distingue entre badge informativo y con estado en vivo (isLive)', () => {
  const liveHtml = renderToStaticMarkup(<Badge isLive variant="default">En vivo</Badge>)
  assert.ok(liveHtml.includes('animate-pulse'), 'Aplica pulsación visual en estado live')
  assert.ok(liveHtml.includes('role="status"'), 'Asigna rol accesible status')
})
