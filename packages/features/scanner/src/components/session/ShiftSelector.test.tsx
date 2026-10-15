import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShiftSelector } from './ShiftSelector'
import type { ShiftOption } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const options: ShiftOption[] = [
  { id: 'shift-1', postServiceId: 7, label: 'Turno Mañana', courtName: 'Cancha Sintética 7' },
  { id: 'shift-2', postServiceId: 9, label: 'Turno Tarde', courtName: 'Cancha Norte 2' },
]

const baseProps = {
  onSelect: () => {},
}

test('ShiftSelector: renders shift options with service details', () => {
  const html = renderToStaticMarkup(
    <ShiftSelector options={options} selectedId={null} isLoading={false} loadError={null} {...baseProps} />
  )

  assert.ok(html.includes('Selecciona el puesto de escaneo'), 'Debe mostrar el título de selección')
  assert.ok(html.includes('Turno Mañana'), 'Debe mostrar la primera opción')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el servicio deportivo')
  assert.ok(html.includes('ID de servicio: 7'), 'Debe mostrar el ID de servicio')
  assert.ok(html.includes('Usar este puesto'), 'Debe incluir CTA por opción')
})

test('ShiftSelector: marks the selected shift as active', () => {
  const html = renderToStaticMarkup(
    <ShiftSelector options={options} selectedId="shift-1" isLoading={false} loadError={null} {...baseProps} />
  )

  assert.ok(html.includes('Activo'), 'Debe marcar la opción seleccionada como activa')
})

test('ShiftSelector: shows loading state', () => {
  const html = renderToStaticMarkup(
    <ShiftSelector options={[]} selectedId={null} isLoading={true} loadError={null} {...baseProps} />
  )

  assert.ok(html.includes('Cargando servicios disponibles'), 'Debe mostrar estado de carga')
})

test('ShiftSelector: shows load error and empty state', () => {
  const errorHtml = renderToStaticMarkup(
    <ShiftSelector options={[]} selectedId={null} isLoading={false} loadError="No se pudo cargar" {...baseProps} />
  )
  assert.ok(errorHtml.includes('role="alert"'), 'El error debe exponerse como alerta')
  assert.ok(errorHtml.includes('No se pudo cargar'), 'Debe mostrar el mensaje de error')

  const emptyHtml = renderToStaticMarkup(
    <ShiftSelector options={[]} selectedId={null} isLoading={false} loadError={null} {...baseProps} />
  )
  assert.ok(emptyHtml.includes('No hay servicios activos'), 'Debe mostrar estado vacío sin opciones')
})
