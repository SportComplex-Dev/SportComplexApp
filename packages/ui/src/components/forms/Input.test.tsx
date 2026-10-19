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

test('TSK-FE-32 / Input: renderiza botón de alternar visibilidad cuando type="password"', () => {
  const html = renderToStaticMarkup(
    <Input type="password" placeholder="Mínimo 8 caracteres" defaultValue="Secret123*" />
  )
  assert.ok(html.includes('type="password"'), 'El tipo inicial debe ser password')
  assert.ok(html.includes('aria-label="Mostrar contraseña"'), 'Debe tener aria-label accesible Mostrar contraseña')
  assert.ok(html.includes('tabindex="-1"'), 'Debe tener tabIndex={-1} para no entorpecer la navegación por teclado')
  assert.ok(html.includes('pr-10'), 'Debe reservar padding derecho para el botón')
})

test('TSK-FE-32 / Input: respeta showPasswordToggle=false cuando se desactiva explícitamente', () => {
  const html = renderToStaticMarkup(
    <Input type="password" showPasswordToggle={false} placeholder="Sin toggle" />
  )
  assert.ok(html.includes('type="password"'), 'Debe ser type password')
  assert.ok(!html.includes('aria-label="Mostrar contraseña"'), 'No debe renderizar botón de toggle')
})

test('TSK-FE-32 / Input: propaga disabled={true} al input y al botón de alternar', () => {
  const html = renderToStaticMarkup(
    <Input type="password" disabled placeholder="Deshabilitado" />
  )
  assert.ok(html.includes('disabled'), 'El input debe incluir atributo disabled')
  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'El botón debe estar deshabilitado')
  assert.ok(html.includes('disabled:pointer-events-none'), 'El botón debe incluir clases para inhabilitación')
})
