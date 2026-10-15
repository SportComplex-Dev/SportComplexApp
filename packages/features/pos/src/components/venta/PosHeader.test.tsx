import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosHeader } from './PosHeader'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

test('PosHeader: renders POS branding and default seller', () => {
  const html = renderToStaticMarkup(<PosHeader />)

  assert.ok(html.includes('TAQUILLA POS'), 'Debe mostrar la marca de taquilla POS')
  assert.ok(html.includes('Punto de Venta Presencial'), 'Debe mostrar el título del punto de venta')
  assert.ok(html.includes('Andrés Muñoz'), 'Debe usar el vendedor por defecto')
  assert.ok(html.includes('100% Cashless'), 'Debe comunicar la política cashless')
})

test('PosHeader: renders custom seller name', () => {
  const html = renderToStaticMarkup(<PosHeader sellerName="María Vendedora" />)

  assert.ok(html.includes('María Vendedora'), 'Debe mostrar el nombre del vendedor activo')
  assert.ok(!html.includes('Andrés Muñoz'), 'No debe mostrar el vendedor por defecto')
})

test('PosHeader: shows cashless operating policy banner', () => {
  const html = renderToStaticMarkup(<PosHeader />)

  assert.ok(
    html.includes('Política Operativa 100% Cashless'),
    'Debe mostrar el banner de política operativa',
  )
  assert.ok(html.includes('Stripe'), 'Debe mencionar el cobro con Stripe')
})
