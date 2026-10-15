import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShiftScannerView } from './ShiftScannerView'
import type { ShiftOption } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const shift: ShiftOption = {
  id: 'shift-1',
  postServiceId: 7,
  label: 'Turno Mañana',
  courtName: 'Cancha Sintética 7',
}

const options: ShiftOption[] = [shift]

const baseProps = {
  shiftOptions: options,
  selectedShiftId: null as string | null,
  isLoadingShifts: false,
  shiftLoadError: null as string | null,
  facingMode: 'environment' as const,
  cameraToast: null as string | null,
  onSelectShift: () => {},
  onToggleFacingMode: () => {},
  onOpenCamera: () => {},
  onScan: () => {},
  onCameraError: () => {},
}

test('ShiftScannerView: renders shift selector when no active shift', () => {
  const html = renderToStaticMarkup(
    <ShiftScannerView activeShift={null} flowState="idle" {...baseProps} />
  )

  assert.ok(html.includes('Selecciona el puesto de escaneo'), 'Debe mostrar el selector sin turno activo')
  assert.ok(html.includes('Turno Mañana'), 'Debe listar las opciones disponibles')
})

test('ShiftScannerView: renders confirmed post with camera controls', () => {
  const html = renderToStaticMarkup(
    <ShiftScannerView activeShift={shift} flowState="scanning" {...baseProps} />
  )

  assert.ok(html.includes('Puesto confirmado'), 'Debe mostrar el panel de puesto confirmado')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar la cancha del turno')
  assert.ok(html.includes('Cambiar cámara'), 'Debe incluir control de cámara')
  assert.ok(html.includes('Cámara activa'), 'Debe indicar cámara activa en estado scanning')
  assert.ok(html.includes('Escaneando activo'), 'Debe mostrar estado de escaneo activo')
})

test('ShiftScannerView: shows camera toast and idle guidance', () => {
  const html = renderToStaticMarkup(
    <ShiftScannerView
      {...baseProps}
      activeShift={shift}
      flowState="starting-camera"
      cameraToast="No se pudo iniciar la cámara"
    />
  )

  assert.ok(html.includes('role="alert"'), 'El aviso de cámara debe exponerse como alerta')
  assert.ok(html.includes('No se pudo iniciar la cámara'), 'Debe mostrar el aviso de cámara')
  assert.ok(html.includes('Esperando QR'), 'Debe mostrar guía en espera fuera de scanning')
})
