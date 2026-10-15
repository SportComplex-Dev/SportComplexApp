import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QRGraphicHD } from './QrGraphic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

test('QRGraphicHD: renders provided dataUrl image', () => {
  const html = renderToStaticMarkup(
    <QRGraphicHD code="TK-001" dataUrl="data:image/png;base64,abc" />
  )

  assert.ok(html.includes('data:image/png;base64,abc'), 'Debe renderizar la imagen provista')
  assert.ok(html.includes('aria-label="Código QR de acceso para ticket TK-001"'), 'Debe etiquetar accesiblemente')
})

test('QRGraphicHD: shows generating state without dataUrl', () => {
  const html = renderToStaticMarkup(<QRGraphicHD code="TK-002" />)

  assert.ok(html.includes('Generando QR'), 'Debe mostrar estado de generación en SSR')
})
