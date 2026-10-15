import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Dialog } from './Dialog'

;(globalThis as unknown as { React: typeof React }).React = React

test('Dialog: renderiza con role dialog', () => {
  const html = renderToStaticMarkup(<Dialog>Contenido</Dialog>)
  assert.ok(html.includes('role="dialog"'), 'Debe incluir role="dialog"')
  assert.ok(html.includes('Contenido'), 'Debe incluir el contenido hijo')
})
