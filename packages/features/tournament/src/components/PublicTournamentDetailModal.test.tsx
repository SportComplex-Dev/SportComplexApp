import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PublicTournamentDetailModal } from './PublicTournamentDetailModal'
import type { PublicTournamentDetailData } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const baseTournament: PublicTournamentDetailData = {
  id: 'tour-pub-1',
  titulo: 'Copa Apertura Pádel',
  descripcion: 'Competencia interna con arbitraje avalado.',
  nivel: 'Segunda Categoría',
  categoria: { id: 1, nombre: 'Pádel' },
  fechaInicio: '2026-11-10T14:00:00.000Z',
  fechaFin: '2026-11-10T18:00:00.000Z',
  cuposTotales: 16,
  cuposDisponibles: 10,
  cuposOcupados: 6,
  precioInscripcion: 0,
}

test('PublicTournamentDetailModal: returns null when closed or without tournament', () => {
  assert.equal(
    renderToStaticMarkup(
      <PublicTournamentDetailModal
        isOpen={false}
        onClose={noop}
        tournament={baseTournament}
        onRegisterClick={noop}
      />,
    ),
    '',
    'Debe retornar vacío cuando está cerrado',
  )
  assert.equal(
    renderToStaticMarkup(
      <PublicTournamentDetailModal
        isOpen={true}
        onClose={noop}
        tournament={null}
        onRegisterClick={noop}
      />,
    ),
    '',
    'Debe retornar vacío sin torneo seleccionado',
  )
})

test('PublicTournamentDetailModal: renders official info with register action', () => {
  const html = renderToStaticMarkup(
    <PublicTournamentDetailModal
      isOpen={true}
      onClose={noop}
      tournament={baseTournament}
      onRegisterClick={noop}
    />,
  )

  assert.ok(
    html.includes('Información Oficial del Torneo'),
    'Debe mostrar el título oficial',
  )
  assert.ok(html.includes('Copa Apertura Pádel'), 'Debe mostrar el título del torneo')
  assert.ok(html.includes('Inscribirme al Torneo'), 'Debe ofrecer la inscripción')
  assert.ok(html.includes('10 cupos disponibles'), 'Debe mostrar la disponibilidad')
  assert.ok(html.includes('role="progressbar"'), 'Debe incluir el medidor de aforo')
})

test('PublicTournamentDetailModal: enrolled player sees portal ticket action', () => {
  const html = renderToStaticMarkup(
    <PublicTournamentDetailModal
      isOpen={true}
      onClose={noop}
      tournament={{ ...baseTournament, yaInscrito: true }}
      onRegisterClick={noop}
    />,
  )

  assert.ok(html.includes('Ver mi Entrada en el Portal'), 'El inscrito debe ver su entrada')
  assert.ok(!html.includes('Inscribirme al Torneo'), 'El inscrito no debe reinscribirse')
})

test('PublicTournamentDetailModal: full tournament disables registration', () => {
  const html = renderToStaticMarkup(
    <PublicTournamentDetailModal
      isOpen={true}
      onClose={noop}
      tournament={{ ...baseTournament, cuposDisponibles: 0, cuposOcupados: 16 }}
      onRegisterClick={noop}
    />,
  )

  assert.ok(html.includes('Sin Cupos Disponibles'), 'Sin cupos debe deshabilitar el registro')
  assert.ok(html.includes('Cupos Agotados'), 'Debe mostrar el badge de agotado')
})

