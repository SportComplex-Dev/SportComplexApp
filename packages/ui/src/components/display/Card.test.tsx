import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Card, CardHeader, CardTitle, CardContent } from './Card'

;(globalThis as unknown as { React: typeof React }).React = React

test('Card (SCRUM-172): Distingue entre tarjeta informativa y tarjeta interactiva', () => {
  const staticHtml = renderToStaticMarkup(
    <Card>
      <CardHeader>
        <CardTitle>Horario de atención</CardTitle>
      </CardHeader>
      <CardContent>Lunes a Domingo</CardContent>
    </Card>
  )
  assert.ok(!staticHtml.includes('interactive-card'), 'Tarjeta informativa es estática')
  assert.ok(staticHtml.includes('Horario de atención'), 'Renderiza el título')

  const interactiveHtml = renderToStaticMarkup(
    <Card interactive>
      <CardContent>Haga clic para reservar</CardContent>
    </Card>
  )
  assert.ok(interactiveHtml.includes('interactive-card'), 'Tarjeta interactiva añade microinteracción')
})
