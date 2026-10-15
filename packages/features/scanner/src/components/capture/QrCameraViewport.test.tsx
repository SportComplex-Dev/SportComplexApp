import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QrCameraViewport } from './QrCameraViewport'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const baseProps = {
  onScan: () => {},
  onCameraError: () => {},
}

test('QrCameraViewport: renders waiting state when disabled (SSR-safe)', () => {
  const html = renderToStaticMarkup(
    <QrCameraViewport enabled={false} facingMode="environment" {...baseProps} />
  )

  assert.ok(html.includes('Esperando cámara'), 'Debe mostrar estado de espera sin cámara activa')
  assert.ok(html.includes('Trasera'), 'Debe indicar cámara trasera para facingMode environment')
  assert.ok(html.includes('scanner-reader'), 'Debe incluir el contenedor del lector QR')
})

test('QrCameraViewport: labels frontal camera correctly', () => {
  const html = renderToStaticMarkup(
    <QrCameraViewport enabled={false} facingMode="user" {...baseProps} />
  )

  assert.ok(html.includes('Frontal'), 'Debe indicar cámara frontal para facingMode user')
  assert.ok(html.includes('Esperando cámara'), 'Debe seguir en espera en render SSR')
})

test('QrCameraViewport: renders scan frame overlay and reader container', () => {
  const html = renderToStaticMarkup(
    <QrCameraViewport enabled={true} facingMode="environment" {...baseProps} />
  )

  assert.ok(html.includes('scanner-reader'), 'Debe incluir el contenedor del lector QR')
  assert.ok(
    html.includes('Esperando cámara') || html.includes('Escaneando'),
    'Debe mostrar algún estado de cámara en SSR'
  )
})
