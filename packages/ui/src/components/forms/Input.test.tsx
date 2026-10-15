import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { Input } from './Input'

;(globalThis as unknown as { React: typeof React }).React = React

test('Input: renderiza con data-slot input y tipo correcto', () => {
  const html = renderToStaticMarkup(<Input type="email" placeholder="test@altura.co" />)
  assert.ok(html.includes('data-slot="input"'), 'Debe incluir data-slot input')
  assert.ok(html.includes('type="email"'), 'Debe preservar el tipo')
  assert.ok(html.includes('placeholder="test@altura.co"'), 'Debe incluir el placeholder')
})
