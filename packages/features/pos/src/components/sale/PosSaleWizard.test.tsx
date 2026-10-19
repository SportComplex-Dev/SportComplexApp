/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToString } from 'react-dom/server'
import type { CatalogItem } from '@sportcomplex/core'
import { PosSaleWizard } from './PosSaleWizard'

// Asegurar React en globalThis
;(globalThis as any).React = React

const mockService: CatalogItem = {
  id: 'serv-101',
  name: 'Cancha Tenis Principal',
  category: 'canchas',
  sede: 'Poblado',
  price: 60000,
  status: 'Disponible',
  capacity: 2,
  description: 'Cancha de arcilla reglamentaria',
}

function createMockPos(overrides: Record<string, any> = {}) {
  return {
    selectedCategory: 'canchas',
    setSelectedCategory: () => {},
    selectedServiceId: 'serv-101',
    setSelectedServiceId: () => {},
    todayStr: '2026-10-19',
    selectedDate: '2026-10-19',
    setSelectedDate: () => {},
    selectedSlot: '16:00 - 17:00',
    setSelectedSlot: () => {},
    availableSlots: ['16:00 - 17:00', '17:00 - 18:00'],
    isLoadingSlots: false,
    attendees: 1,
    setAttendees: () => {},
    clientName: 'Alejandro Morales',
    setClientName: () => {},
    clientDoc: '1098765432',
    setClientDoc: () => {},
    clientEmail: 'alejandro@akros.test',
    setClientEmail: () => {},
    clientPhone: '3109876543',
    setClientPhone: () => {},
    isMember: true,
    setIsMember: () => {},
    isProcessing: false,
    processStep: '',
    confirmedBooking: null,
    receiptQrUrl: null,
    receiptComprobante: null,
    isAltLinkModalOpen: false,
    setIsAltLinkModalOpen: () => {},
    handleCloseAltLink: () => {},
    isAwaitingPayment: false,
    isStripeTestMode: true,
    altLinkUrl: '',
    altLinkQrUrl: null,
    copiedLink: false,
    filteredServices: [mockService],
    currentService: mockService,
    subtotalBruto: 60000,
    descuentoMonto: 18000,
    totalFinal: 42000,
    subtotalNeto: 35294,
    ivaMonto: 6706,
    handleQuickWalkIn: () => {},
    handleGenerateAltLink: async () => {},
    handleCopyLink: () => {},
    handleResetForNextSale: () => {},
    ...overrides,
  } as any
}

test('PosSaleWizard: renderiza el stepper con los 3 pasos numerados y títulos', () => {
  const pos = createMockPos()
  const html = renderToString(
    React.createElement(PosSaleWizard, { sellerName: 'Carlos Taquilla', pos }),
  )

  // Comprobar la presencia de los 3 pasos en el Stepper
  assert.ok(html.includes('Paso 1'), 'Debe mostrar etiqueta Paso 1')
  assert.ok(html.includes('Servicio y Franja'), 'Debe mostrar título Servicio y Franja')
  assert.ok(html.includes('Paso 2'), 'Debe mostrar etiqueta Paso 2')
  assert.ok(html.includes('Cliente Taquilla'), 'Debe mostrar título Cliente Taquilla')
  assert.ok(html.includes('Paso 3'), 'Debe mostrar etiqueta Paso 3')
  assert.ok(html.includes('Cobro Stripe'), 'Debe mostrar título Cobro Stripe')
  assert.ok(html.includes('data-testid="pos-sale-wizard"'))
})

test('PosSaleWizard: en el paso 1 muestra el selector de catálogo y el botón de avance', () => {
  const pos = createMockPos({ selectedSlot: '16:00 - 17:00' })
  const html = renderToString(
    React.createElement(PosSaleWizard, { sellerName: 'Carlos Taquilla', pos }),
  )

  assert.ok(html.includes('Cancha Tenis Principal'))
  assert.ok(html.includes('Resumen de Selección'))
  assert.ok(html.includes('data-testid="pos-step1-next"'))
  assert.ok(html.includes('Continuar con Datos del Cliente'))
})

test('PosSaleWizard: el botón de avance del paso 1 se deshabilita si no hay franja horaria seleccionada', () => {
  const pos = createMockPos({ selectedSlot: '' })
  const html = renderToString(
    React.createElement(PosSaleWizard, { sellerName: 'Carlos Taquilla', pos }),
  )

  assert.ok(html.includes('disabled=""') || html.includes('disabled'), 'El botón debe estar deshabilitado')
  assert.ok(html.includes('Selecciona una franja horaria para continuar'))
})
