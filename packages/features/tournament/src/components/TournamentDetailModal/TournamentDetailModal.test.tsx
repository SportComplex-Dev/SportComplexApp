import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TournamentDetailModal } from './TournamentDetailModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

test('TournamentDetailModal: returns null when closed', () => {
  const html = renderToStaticMarkup(
    <TournamentDetailModal isOpen={false} onClose={noop} tournamentId="t-1" />,
  )

  assert.equal(html, '', 'Debe retornar vacío cuando el modal está cerrado')
})

test('TournamentDetailModal: renders shell with fallback title while loading (SSR has no data)', () => {
  const html = renderToStaticMarkup(
    <TournamentDetailModal isOpen={true} onClose={noop} tournamentId="t-1" />,
  )

  assert.ok(html.includes('Detalle del Torneo'), 'Debe mostrar el título por defecto sin datos')
  assert.ok(html.includes('role="dialog"'), 'Debe exponer el diálogo accesible')
  assert.ok(html.includes('Cerrar'), 'Debe incluir acción de cierre')
})

test('TournamentDetailModal: open without tournament id renders shell too', () => {
  const html = renderToStaticMarkup(
    <TournamentDetailModal isOpen={true} onClose={noop} tournamentId={null} />,
  )

  assert.ok(html.includes('Detalle del Torneo'), 'Sin id debe mostrar el título por defecto')
})
