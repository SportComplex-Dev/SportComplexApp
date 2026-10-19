import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScannerCameraView } from './ScannerCameraView'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const baseProps = {
  onStartCamera: () => {},
  onStopCamera: () => {},
}

test('ScannerCameraView: shows paused state with start action', () => {
  const html = renderToStaticMarkup(
    <ScannerCameraView
      consultationCameraActive={false}
      consultationLoading={false}
      consultationCameraError={null}
      {...baseProps}
    />
  )

  assert.ok(html.includes('Lector de Cámara'), 'Debe mostrar el título del lector')
  assert.ok(html.includes('Iniciar cámara'), 'Debe ofrecer iniciar la cámara')
  assert.ok(html.includes('pausada'), 'Debe indicar que la cámara está pausada')
})

test('ScannerCameraView: shows active state with pause action', () => {
  const html = renderToStaticMarkup(
    <ScannerCameraView
      consultationCameraActive={true}
      consultationLoading={false}
      consultationCameraError={null}
      {...baseProps}
    />
  )

  assert.ok(html.includes('Pausar'), 'Debe ofrecer pausar la cámara activa')
  assert.ok(html.includes('id="qr-reader"'), 'Debe incluir el contenedor DOM del lector QR')
})

test('ScannerCameraView: surfaces camera error and loading state', () => {
  const errorHtml = renderToStaticMarkup(
    <ScannerCameraView
      consultationCameraActive={false}
      consultationLoading={false}
      consultationCameraError="Permiso denegado"
      {...baseProps}
    />
  )
  assert.ok(errorHtml.includes('Permiso denegado'), 'Debe mostrar el error de cámara')

  const loadingHtml = renderToStaticMarkup(
    <ScannerCameraView
      consultationCameraActive={true}
      consultationLoading={true}
      consultationCameraError={null}
      {...baseProps}
    />
  )
  assert.ok(loadingHtml.includes('Consultando información'), 'Debe mostrar estado de consulta')
  assert.ok(loadingHtml.includes('disabled'), 'Debe deshabilitar el botón durante la carga')
})
