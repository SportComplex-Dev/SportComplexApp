import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PosCatalogSelector } from './PosCatalogSelector'
import type { CatalogItem } from '@sportcomplex/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const service: CatalogItem = {
  id: 'svc-1',
  name: 'Cancha Sintética 7',
  category: 'canchas',
  sede: 'Norte',
  description: 'Cancha sintética de fútbol 7.',
  price: 140000,
  capacity: 14,
  status: 'Disponible',
}

const gymService: CatalogItem = {
  id: 'svc-gym',
  name: 'Gimnasio Funcional',
  category: 'gimnasio',
  sede: 'Sur',
  description: 'Acceso por turno.',
  price: 25000,
  capacity: 20,
  status: 'Disponible',
}

const baseProps = {
  selectedCategory: 'canchas',
  onSelectCategory: noop,
  selectedServiceId: 'svc-1',
  onSelectServiceId: noop,
  selectedDate: '2026-10-20',
  onSelectDate: noop,
  selectedSlot: '18:00 - 19:00',
  onSelectSlot: noop,
  attendees: 2,
  onSetAttendees: noop,
  filteredServices: [service] as CatalogItem[],
  todayStr: '2026-10-20',
  availableSlots: ['18:00 - 19:00', '19:00 - 20:00'],
}

test('PosCatalogSelector: renders service list, date and slots', () => {
  const html = renderToStaticMarkup(
    <PosCatalogSelector {...baseProps} currentService={service} />,
  )

  assert.ok(html.includes('Servicio y Disponibilidad'), 'Debe mostrar el título del paso 1')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe listar el servicio filtrado')
  assert.ok(html.includes('pos-date-input'), 'Debe incluir el selector de fecha')
  assert.ok(html.includes('Franja Horaria Disponible'), 'Debe mostrar las franjas horarias')
  assert.ok(html.includes('18:00'), 'Debe mostrar el inicio de la franja')
})

test('PosCatalogSelector: shows empty state without services', () => {
  const html = renderToStaticMarkup(
    <PosCatalogSelector
      {...baseProps}
      filteredServices={[]}
      selectedServiceId=""
      currentService={undefined}
      availableSlots={[]}
    />,
  )

  assert.ok(
    html.includes('No hay servicios disponibles en esta categoría'),
    'Debe informar cuando no hay servicios',
  )
})

test('PosCatalogSelector: shows loading hint while fetching slots', () => {
  const html = renderToStaticMarkup(
    <PosCatalogSelector {...baseProps} currentService={service} isLoadingSlots={true} />,
  )

  assert.ok(html.includes('Consultando aforo'), 'Debe indicar la consulta de aforo en curso')
})

test('PosCatalogSelector: shows attendees stepper for non-court services', () => {
  const html = renderToStaticMarkup(
    <PosCatalogSelector
      {...baseProps}
      filteredServices={[gymService]}
      selectedServiceId="svc-gym"
      currentService={gymService}
    />,
  )

  assert.ok(html.includes('Cantidad de Cupos'), 'Debe mostrar el selector de cupos')
  assert.ok(html.includes('Aumentar cupos'), 'Debe ofrecer aumentar cupos')
})
