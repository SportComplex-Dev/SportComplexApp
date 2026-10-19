import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExpiredSlotScreen } from './ExpiredSlotScreen'
import type { ExpiredSlotDetails } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const afterDetails: ExpiredSlotDetails = {
  slotStart: '18:00',
  slotEnd: '19:00',
  scannedAt: '2026-10-20T19:25:00-05:00',
  windowPosition: 'AFTER',
  ticketStatus: 'EMITIDO',
  minutesFromBoundary: 25,
}

const beforeDetails: ExpiredSlotDetails = {
  slotStart: '18:00',
  slotEnd: '19:00',
  scannedAt: '2026-10-20T17:40:00-05:00',
  windowPosition: 'BEFORE',
  ticketStatus: 'EMITIDO',
  minutesFromBoundary: 20,
}

const baseProps = {
  userName: 'Carlos Cliente',
  ticketId: 'ticket-exp-001',
  reservationId: 'reserva-456',
  targetCourtName: 'Cancha Sintética 7',
  onContinue: () => {},
}

test('ExpiredSlotScreen: renders expired state after the slot ended', () => {
  const html = renderToStaticMarkup(
    <ExpiredSlotScreen {...baseProps} expiredDetails={afterDetails} />
  )

  assert.ok(html.includes('role="alertdialog"'), 'Debe ser un diálogo de alerta bloqueante')
  assert.ok(html.includes('DENEGADO_HORARIO'), 'Debe mostrar el estado de denegación horaria')
  assert.ok(html.includes('ticket-exp-001'), 'Debe mostrar el ticket')
  assert.ok(html.includes('reserva-456'), 'Debe mostrar la reserva')
  assert.ok(html.includes('Finalizó hace 25 min'), 'Debe indicar distancia posterior a la franja')
})

test('ExpiredSlotScreen: renders before-window guidance', () => {
  const html = renderToStaticMarkup(
    <ExpiredSlotScreen {...baseProps} expiredDetails={beforeDetails} />
  )

  assert.ok(html.includes('Faltan 20 min para iniciar'), 'Debe indicar minutos faltantes')
  assert.ok(html.includes('18:00 - 19:00'), 'Debe mostrar la hora reservada')
  assert.ok(html.includes('EMITIDO'), 'Debe aclarar que el boleto permanece emitido')
})

test('ExpiredSlotScreen: shows custom message, camera error and POS fallback', () => {
  const html = renderToStaticMarkup(
    <ExpiredSlotScreen
      {...baseProps}
      expiredDetails={afterDetails}
      message="Franja vencida personalizada"
      cameraError="Cámara no disponible"
    />
  )

  assert.ok(html.includes('Franja vencida personalizada'), 'Debe mostrar el mensaje personalizado')
  assert.ok(html.includes('Cámara no disponible'), 'Debe mostrar el error de cámara')
  assert.ok(html.includes('Derivar a Taquilla / POS'), 'Debe ofrecer derivación a POS')
  assert.ok(html.includes('Entendido / Continuar Escaneando'), 'Debe incluir acción de continuar')
})
