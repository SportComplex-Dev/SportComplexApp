import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
// @ts-expect-error react-dom/server typings
import { renderToStaticMarkup } from 'react-dom/server'
import { ActionButton } from './ActionButton'

;(globalThis as unknown as { React: typeof React }).React = React

test('ActionButton (TSK-FE-38): Renderiza con clase base action-button y estilos semánticos', () => {
  const html = renderToStaticMarkup(
    <ActionButton>Continuar al pago</ActionButton>
  )
  assert.ok(html.includes('action-button'), 'Debe incluir clase action-button')
  assert.ok(html.includes('Continuar al pago'), 'Debe incluir el texto del botón')
})

test('ActionButton (TSK-FE-38): Preserva variantes secondary y danger', () => {
  const secondaryHtml = renderToStaticMarkup(
    <ActionButton secondary>Secundario</ActionButton>
  )
  assert.ok(secondaryHtml.includes('action-secondary'), 'Debe incluir action-secondary')

  const dangerHtml = renderToStaticMarkup(
    <ActionButton danger>Eliminar</ActionButton>
  )
  assert.ok(dangerHtml.includes('action-danger'), 'Debe incluir action-danger')
})

test('ActionButton (TSK-FE-38): Respeta prop disabled={true}', () => {
  const html = renderToStaticMarkup(
    <ActionButton disabled>Deshabilitado</ActionButton>
  )
  assert.ok(html.includes('disabled'), 'Debe tener atributo disabled')
  assert.ok(html.includes('aria-disabled="true"'), 'Debe incluir aria-disabled')
})

test('ActionButton (TSK-FE-38): isSubmitting={true} activa spinner y aria-busy en Button sin duplicar SVGs', () => {
  const html = renderToStaticMarkup(
    <ActionButton isSubmitting>Enviando...</ActionButton>
  )
  assert.ok(html.includes('disabled'), 'Debe estar deshabilitado mientras se envía')
  assert.ok(html.includes('aria-busy="true"'), 'Debe marcarse como ocupado (aria-busy)')
  assert.ok(html.includes('animate-spin'), 'Debe incluir el spinner de carga')
  assert.ok(html.includes('Enviando...'), 'Debe preservar el contenido del botón')

  // Verificar que NO haya dos spinners SVG duplicados
  const spinnerCount = (html.match(/animate-spin/g) || []).length
  assert.equal(spinnerCount, 1, 'Debe haber exactamente 1 spinner SVG (sin duplicados)')
})
