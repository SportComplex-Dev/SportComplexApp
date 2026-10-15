import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ScannerHeader } from './ScannerHeader'
import type { ShiftOption } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const shift: ShiftOption = {
  id: 'shift-1',
  postServiceId: 7,
  label: 'Turno Mañana',
  courtName: 'Cancha Sintética 7',
}

const baseProps = {
  onToggleAudio: () => {},
  onToggleTheme: () => {},
  onChangeShift: () => {},
}

test('ScannerHeader: renders empty-shift state when no active shift', () => {
  const html = renderToStaticMarkup(
    <ScannerHeader activeShift={null} audioEnabled={true} theme="dark" {...baseProps} />
  )

  assert.ok(html.includes('Sin turno activo'), 'Debe mostrar estado sin turno activo')
  assert.ok(html.includes('AKROS Club'), 'Debe mostrar la marca del club')
})

test('ScannerHeader: renders active shift label and court name', () => {
  const html = renderToStaticMarkup(
    <ScannerHeader activeShift={shift} audioEnabled={false} theme="light" {...baseProps} />
  )

  assert.ok(html.includes('Turno Mañana'), 'Debe mostrar el label del turno')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el nombre de la cancha')
  assert.ok(html.includes('Cambiar puesto'), 'Debe incluir acción de cambiar puesto')
})

test('ScannerHeader: dark theme offers light-mode toggle and audio ON', () => {
  const html = renderToStaticMarkup(
    <ScannerHeader activeShift={shift} audioEnabled={true} theme="dark" {...baseProps} />
  )

  assert.ok(html.includes('aria-label="Activar modo claro"'), 'Debe ofrecer activar modo claro en tema oscuro')
  assert.ok(html.includes('aria-label="Silenciar audio"'), 'Debe ofrecer silenciar cuando el audio está activo')
  assert.ok(html.includes('Audio ON'), 'Debe mostrar estado Audio ON')
})

test('ScannerHeader: light theme offers dark-mode toggle and audio OFF', () => {
  const html = renderToStaticMarkup(
    <ScannerHeader activeShift={null} audioEnabled={false} theme="light" {...baseProps} />
  )

  assert.ok(html.includes('aria-label="Activar modo oscuro"'), 'Debe ofrecer activar modo oscuro en tema claro')
  assert.ok(html.includes('aria-label="Activar audio"'), 'Debe ofrecer activar audio cuando está apagado')
  assert.ok(html.includes('Audio OFF'), 'Debe mostrar estado Audio OFF')
})
