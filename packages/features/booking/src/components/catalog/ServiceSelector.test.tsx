import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ServiceSelector } from './ServiceSelector'
import type { DynamicTimeSlot } from '../../types/cart'

;(globalThis as unknown as { React: typeof React }).React = React

test('ServiceSelector component is defined and exported as a function', () => {
  assert.equal(typeof ServiceSelector, 'function')
})

test('ServiceSelector: renderiza con soporte para basePricePerHour, isMember, serviceName y onValidationError', () => {
  const mockSlots: DynamicTimeSlot[] = [
    { startTime: '07:00', endTime: '08:00', label: '07:00 – 08:00', isAvailable: true },
    { startTime: '08:00', endTime: '09:00', label: '08:00 – 09:00', isAvailable: true },
  ]

  let validationErrorReceived = ''
  let slotSelected: DynamicTimeSlot | null = mockSlots[0] ?? null

  const html = renderToStaticMarkup(
    <ServiceSelector
      date="2026-10-25"
      onDateChange={() => {}}
      timeSlots={mockSlots}
      selectedSlot={slotSelected}
      onSelectSlot={(slot) => {
        slotSelected = slot
      }}
      selectedSlots={[mockSlots[0] as DynamicTimeSlot]}
      onSlotsChange={() => {}}
      selectedCategory="todos"
      onCategoryChange={() => {}}
      cartServiceIds={[]}
      onAddService={() => {}}
      basePricePerHour={50000}
      isMember={true}
      serviceName="Cancha de Tenis"
      onValidationError={(msg) => {
        validationErrorReceived = msg
      }}
    />
  )

  assert.ok(html.includes('Paso 1 · Fecha y horario dinámico'))
  assert.ok(html.includes('Cancha de Tenis'))
  assert.ok(html.includes('30% Descuento Socio Activo'))
  assert.equal(typeof validationErrorReceived, 'string')
})

