import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConsultationResultCard } from './ConsultationResultCard'
import type { TicketInfo } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const ticket: TicketInfo = {
  id: 'ticket-cons-001',
  reservaId: 'reserva-789',
  estado: 'EMITIDO',
  servicioId: 7,
  servicioNombre: 'Cancha Sintética 7',
  fecha: '2026-10-22',
  horaInicio: '18:00',
  horaFin: '19:00',
  titularId: 'user-2',
  titularNombre: 'María Titular',
}

test('ConsultationResultCard: renders the four mandatory fields', () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard ticket={ticket} modo="CONSULTA" onReset={() => {}} />
  )

  assert.ok(html.includes('Cancha Sintética 7'), 'Debe mostrar el servicio')
  assert.ok(html.includes('María Titular'), 'Debe mostrar el titular')
  assert.ok(html.includes('2026-10-22'), 'Debe mostrar la fecha programada')
  assert.ok(html.includes('18:00'), 'Debe mostrar el inicio de la franja')
  assert.ok(html.includes('19:00'), 'Debe mostrar el fin de la franja')
  assert.ok(html.includes('EMITIDO'), 'Debe mostrar el estado del boleto')
})

test('ConsultationResultCard: shows cached banner when data is local', () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard ticket={ticket} modo="CONSULTA" isCached={true} onReset={() => {}} />
  )

  assert.ok(html.includes('cached-status-badge'), 'Debe mostrar insignia de caché')
  assert.ok(html.includes('cached-warning-banner'), 'Debe mostrar banner de advertencia de caché')
})

test('ConsultationResultCard: is informative-only with reset action and no redeem', () => {
  const html = renderToStaticMarkup(
    <ConsultationResultCard ticket={ticket} modo="TURNO" onReset={() => {}} />
  )

  assert.ok(html.includes('Modo: TURNO'), 'Debe mostrar el modo operativo')
  assert.ok(html.includes('Consultar otro boleto'), 'Debe incluir botón de nueva consulta')
  assert.ok(html.includes('no se realizan gastos ni canjes'), 'Debe garantizar que no hay canje')
  assert.ok(!html.includes('Dar Acceso'), 'No debe incluir botón de canje')
})
