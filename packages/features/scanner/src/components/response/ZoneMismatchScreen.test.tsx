import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ZoneMismatchScreen } from './ZoneMismatchScreen'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const message = 'Acceso denegado: El tiquete pertenece a Cancha Sintética 7 y se encuentra en Cancha Norte 2'

test('ZoneMismatchScreen: renders literal backend message and blocking state', () => {
  const html = renderToStaticMarkup(
    <ZoneMismatchScreen message={message} onContinue={() => {}} />
  )

  assert.ok(html.includes('role="alertdialog"'), 'Debe ser un diálogo de alerta bloqueante')
  assert.ok(html.includes(message), 'Debe presentar el texto literal del 403')
  assert.ok(html.includes('DENEGADO_SERVICIO'), 'Debe mostrar el estado de denegación por servicio')
})

test('ZoneMismatchScreen: highlights destination service and current post', () => {
  const html = renderToStaticMarkup(
    <ZoneMismatchScreen message={message} ticketId="ticket-xyz" onContinue={() => {}} />
  )

  assert.ok(html.includes('DIRIJA AL USUARIO A'), 'Debe incluir guía de redirección')
  assert.ok(html.includes('Cancha Sintética 7'), 'Debe destacar el servicio destino del ticket')
  assert.ok(html.includes('Ticket: ticket-xyz'), 'Debe mostrar la referencia del ticket')
  assert.ok(html.includes('Puesto actual:'), 'Debe mostrar el puesto actual extraído del mensaje')
})

test('ZoneMismatchScreen: renders continue action and no redeem actions', () => {
  const html = renderToStaticMarkup(
    <ZoneMismatchScreen message={message} onContinue={() => {}} />
  )

  assert.ok(html.includes('Entendido / Continuar escaneando'), 'Debe incluir acción de continuar')
  assert.ok(html.includes('EMITIDO'), 'Debe aclarar que el boleto permanece emitido')
  assert.ok(!html.includes('Dar Acceso'), 'No debe incluir acciones de canje')
})

test('ZoneMismatchScreen: fallback robusto si el mensaje no sigue el formato', () => {
  const html = renderToStaticMarkup(
    <ZoneMismatchScreen message="El ticket pertenece a otro escenario deportivo." onContinue={() => {}} />
  )

  assert.ok(
    html.includes('El ticket pertenece a otro escenario deportivo.'),
    'Debe mostrar el literal aunque no sea parseable'
  )
  assert.ok(
    !html.includes('DIRIJA AL USUARIO A'),
    'Sin formato válido no debe inventar una zona destino'
  )
})
