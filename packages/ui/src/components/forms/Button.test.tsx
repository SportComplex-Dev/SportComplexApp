import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Button } from './Button'

;(globalThis as unknown as { React: typeof React }).React = React

test('Button (SCRUM-172): Renderiza con clase base interactive-button y microinteracciones accesibles de foco', () => {
  const html = renderToStaticMarkup(
    <Button variant="default" size="default">
      Reservar ahora
    </Button>
  )
  assert.ok(html.includes('interactive-button'), 'Debe incluir interactive-button')
  assert.ok(html.includes('focus-visible:ring-2'), 'Debe incluir anillo de foco visible')
  assert.ok(html.includes('focus-visible:ring-primary'), 'Debe usar el anillo de foco del tema primario')
  assert.ok(html.includes('focus-visible:ring-offset-2'), 'Debe incluir separación ring-offset')
  assert.ok(html.includes('motion-reduce:transform-none'), 'Debe respetar prefers-reduced-motion')
  assert.ok(html.includes('Reservar ahora'), 'Debe renderizar el texto del botón')
})

test('Button (SCRUM-172): Preserva variantes y clases personalizadas', () => {
  const brandHtml = renderToStaticMarkup(<Button variant="brand">Brand</Button>)
  assert.ok(brandHtml.includes('bg-[#123e30]'), 'Variante brand preserva color institucional')

  const accentHtml = renderToStaticMarkup(<Button variant="accent">Accent</Button>)
  assert.ok(accentHtml.includes('bg-[#c9ef75]'), 'Variante accent preserva color de acento')

  const customHtml = renderToStaticMarkup(
    <Button variant="outline" className="my-custom-class">
      Custom
    </Button>
  )
  assert.ok(customHtml.includes('my-custom-class'), 'Preserva clases personalizadas')
})
