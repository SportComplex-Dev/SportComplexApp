import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReservationModal } from './ReservationModal'
import type { CatalogItem } from '@sportcomplex/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const courtItem: CatalogItem = {
  id: 'cancha-1',
  name: 'Cancha Sintética 7',
  category: 'canchas',
  sede: 'Norte',
  description: 'Cancha sintética de fútbol 7.',
  price: 140000,
  capacity: 14,
  status: 'Disponible',
}

const gymItem: CatalogItem = {
  id: 'gym-1',
  name: 'Gimnasio Funcional',
  category: 'gimnasio',
  sede: 'Sur',
  description: 'Acceso por turno al gimnasio.',
  price: 25000,
  capacity: 20,
  status: 'Disponible',
}

const baseProps = {
  close: () => {},
  proceed: () => {},
  date: '2026-10-25',
  time: '18:00 - 19:00',
}

test('ReservationModal: renders summary with service, date slot and actions', () => {
  const html = renderToStaticMarkup(
    <ReservationModal {...baseProps} item={courtItem} attendees={14} />,
  )

  assert.ok(html.includes('RESUMEN DE TU RESERVA'), 'Debe mostrar el encabezado del resumen')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el nombre del servicio')
  assert.ok(html.includes('18:00 - 19:00'), 'Debe mostrar la franja horaria')
  assert.ok(html.includes('Continuar al pago'), 'Debe ofrecer continuar al pago')
  assert.ok(html.includes('Seguir explorando'), 'Debe ofrecer seguir explorando')
  assert.ok(html.includes('aria-label="Cerrar"'), 'Debe incluir botón de cierre accesible')
})

test('ReservationModal: court price is flat regardless of attendees', () => {
  const html = renderToStaticMarkup(
    <ReservationModal {...baseProps} item={courtItem} attendees={14} />,
  )

  assert.ok(html.includes('Cancha completa'), 'La cancha debe venderse como espacio completo')
  assert.ok(!html.includes('14 asistentes'), 'No debe multiplicar por asistentes en canchas')
})

test('ReservationModal: non-court service multiplies price by attendees', () => {
  const html = renderToStaticMarkup(
    <ReservationModal {...baseProps} item={gymItem} attendees={3} />,
  )

  assert.ok(html.includes('3 asistentes'), 'Debe mostrar el número de asistentes')
  // 25000 * 3 = 75000
  assert.ok(html.includes('75'), 'El total estimado debe reflejar precio por asistente')
})
