import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SlotPicker } from './SlotPicker'
import { validateContinuousSlots, calculateMultiSlotPricing } from '../services/cartUtils'
import type { DynamicTimeSlot } from '../types/cart'

;(globalThis as unknown as { React: typeof React }).React = React

const mockSlots: DynamicTimeSlot[] = [
  { startTime: '07:00', endTime: '08:00', label: '07:00 – 08:00', isAvailable: true },
  { startTime: '08:00', endTime: '09:00', label: '08:00 – 09:00', isAvailable: true },
  { startTime: '09:00', endTime: '10:00', label: '09:00 – 10:00', isAvailable: true },
  { startTime: '10:00', endTime: '11:00', label: '10:00 – 11:00', isAvailable: false, disabledReason: 'Ocupado' },
  { startTime: '11:00', endTime: '12:00', label: '11:00 – 12:00', isAvailable: true },
]

test('TSK-FE-31 / validateContinuousSlots: acepta rango de 1 o más franjas consecutivas', () => {
  assert.equal(validateContinuousSlots([mockSlots[0]]).valid, true)
  assert.equal(validateContinuousSlots([mockSlots[0], mockSlots[1]]).valid, true)
  assert.equal(validateContinuousSlots([mockSlots[0], mockSlots[1], mockSlots[2]]).valid, true)
})

test('TSK-FE-31 / validateContinuousSlots: rechaza franjas con huecos temporales (gaps)', () => {
  const result = validateContinuousSlots([mockSlots[0], mockSlots[2]]) // 07-08 y 09-10 (falta 08-09)
  assert.equal(result.valid, false)
  assert.ok(result.message?.includes('continuas'))

  const gapResult = validateContinuousSlots([mockSlots[0], mockSlots[4]]) // 07-08 y 11-12
  assert.equal(gapResult.valid, false)
})

test('TSK-FE-31 / calculateMultiSlotPricing: calcula subtotal por cantidad de horas y aplica 30% a socios', () => {
  const p1 = calculateMultiSlotPricing(50000, 1, false)
  assert.equal(p1.subtotal, 50000)
  assert.equal(p1.discountAmount, 0)
  assert.equal(p1.total, 50000)

  const p2 = calculateMultiSlotPricing(50000, 2, false)
  assert.equal(p2.subtotal, 100000)
  assert.equal(p2.discountAmount, 0)
  assert.equal(p2.total, 100000)

  const pMember = calculateMultiSlotPricing(50000, 2, true)
  assert.equal(pMember.subtotal, 100000)
  assert.equal(pMember.discountPct, 30)
  assert.equal(pMember.discountAmount, 30000)
  assert.equal(pMember.total, 70000)
})

test('TSK-FE-31 / SlotPicker: renderiza franjas horarias y resumen reactivo de subtotal', () => {
  const html = renderToStaticMarkup(
    <SlotPicker
      timeSlots={mockSlots}
      selectedSlots={[mockSlots[0], mockSlots[1]]}
      onSlotsChange={() => {}}
      basePricePerHour={40000}
      isMember={true}
      serviceName="Cancha de Tenis 1"
      onValidationError={() => {}}
    />
  )

  assert.ok(html.includes('07:00 – 09:00'), 'Debe mostrar el rango continuo consolidado')
  assert.ok(html.includes('2 horas continuas'), 'Debe contabilizar 2 horas')
  assert.ok(html.includes('30% Descuento Socio Activo'), 'Debe mostrar el badge de membresía')
  assert.ok(html.includes('Cancha de Tenis 1'), 'Debe incluir el nombre del servicio')
})

test('TSK-FE-31 / SlotPicker: calcula tarifas dinámicas según servicio (Piscina $15.000 vs Tenis $50.000)', () => {
  // Piscina: 3 horas continuas a $15.000/h sin membresía = $45.000
  const pricingPiscina = calculateMultiSlotPricing(15000, 3, false)
  assert.equal(pricingPiscina.subtotal, 45000)
  assert.equal(pricingPiscina.discountAmount, 0)
  assert.equal(pricingPiscina.total, 45000)

  // Tenis: 2 horas continuas a $50.000/h con membresía socio (30% dto) = $70.000
  const pricingTenisSocio = calculateMultiSlotPricing(50000, 2, true)
  assert.equal(pricingTenisSocio.subtotal, 100000)
  assert.equal(pricingTenisSocio.discountAmount, 30000)
  assert.equal(pricingTenisSocio.total, 70000)

  const piscinaHtml = renderToStaticMarkup(
    <SlotPicker
      timeSlots={mockSlots}
      selectedSlots={[mockSlots[0], mockSlots[1], mockSlots[2]]}
      onSlotsChange={() => {}}
      basePricePerHour={15000}
      isMember={false}
      serviceName="Piscina Climatizada"
    />
  )
  assert.ok(piscinaHtml.includes('Piscina Climatizada'), 'Debe mostrar el nombre de Piscina')
  assert.ok(piscinaHtml.includes('3 horas continuas'), 'Debe reflejar 3 horas')
  assert.ok(!piscinaHtml.includes('30% Descuento'), 'No debe mostrar descuento si no es socio')
})

