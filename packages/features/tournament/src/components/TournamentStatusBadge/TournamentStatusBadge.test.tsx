import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  TournamentStatusBadge,
  InscriptionStatusBadge,
  tournamentConfig,
  inscripcionConfig,
} from './TournamentStatusBadge'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

test('TournamentStatusBadge: renders label for each tournament status', () => {
  for (const [status, config] of Object.entries(tournamentConfig)) {
    const html = renderToStaticMarkup(<TournamentStatusBadge status={status} />)
    assert.ok(
      html.includes(config.label),
      `Debe mostrar la etiqueta "${config.label}" para ${status}`,
    )
  }
})

test('TournamentStatusBadge: open registrations badge copy', () => {
  const html = renderToStaticMarkup(<TournamentStatusBadge status="INSCRIPCIONES_ABIERTAS" />)

  assert.ok(html.includes('Inscripciones Abiertas'), 'Debe mostrar inscripciones abiertas')
})

test('TournamentStatusBadge: unknown status falls back to draft', () => {
  const html = renderToStaticMarkup(<TournamentStatusBadge status="ESTADO_FANTASMA" />)

  assert.ok(html.includes('Borrador'), 'Un estado desconocido debe caer al borrador')
})

test('InscriptionStatusBadge: renders inscription states', () => {
  for (const [status, config] of Object.entries(inscripcionConfig)) {
    const html = renderToStaticMarkup(<InscriptionStatusBadge status={status} />)
    assert.ok(
      html.includes(config.label),
      `Debe mostrar la etiqueta "${config.label}" para ${status}`,
    )
  }
})
