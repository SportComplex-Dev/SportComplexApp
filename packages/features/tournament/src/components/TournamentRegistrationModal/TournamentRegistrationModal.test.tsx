import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TournamentRegistrationModal } from './TournamentRegistrationModal'
import type { TournamentRegisterTarget } from '../../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const noop = () => {}

const freeTournament: TournamentRegisterTarget = {
  id: 'tour-free',
  titulo: 'Copa Apertura Pádel',
  nivel: 'Segunda Categoría (Intermedio Alto)',
  categoria: { id: 1, nombre: 'Pádel' },
  fechaInicio: '2026-11-10T14:00:00.000Z',
  fechaFin: '2026-11-12T18:00:00.000Z',
  cuposTotales: 16,
  cuposDisponibles: 12,
  cuposOcupados: 4,
  precioInscripcion: 0,
}

const paidTournament: TournamentRegisterTarget = {
  ...freeTournament,
  id: 'tour-paid',
  precioInscripcion: 50000,
}

test('TournamentRegistrationModal: returns null when closed or without tournament', () => {
  assert.equal(
    renderToStaticMarkup(
      <TournamentRegistrationModal
        isOpen={false}
        onClose={noop}
        tournament={freeTournament}
      />,
    ),
    '',
    'Debe retornar vacío cuando está cerrado',
  )
  assert.equal(
    renderToStaticMarkup(
      <TournamentRegistrationModal isOpen={true} onClose={noop} tournament={null} />,
    ),
    '',
    'Debe retornar vacío sin torneo seleccionado',
  )
})

test('TournamentRegistrationModal: free tournament shows form for authenticated users', () => {
  const html = renderToStaticMarkup(
    <TournamentRegistrationModal
      isOpen={true}
      onClose={noop}
      tournament={freeTournament}
      session={{ email: 'socio@club.com', name: 'Socio' }}
    />,
  )

  assert.ok(html.includes('Copa Apertura Pádel'), 'Debe mostrar el título del torneo')
  assert.ok(html.includes('Confirmar Inscripción'), 'Debe ofrecer confirmar la inscripción')
  assert.ok(html.includes('pareja-nombre'), 'Debe incluir el campo de pareja opcional')
})

test('TournamentRegistrationModal: requires login for anonymous users', () => {
  const html = renderToStaticMarkup(
    <TournamentRegistrationModal
      isOpen={true}
      onClose={noop}
      tournament={freeTournament}
      session={null}
    />,
  )

  assert.ok(
    html.includes('Inicio de sesión requerido'),
    'Debe exigir inicio de sesión a anónimos',
  )
  assert.ok(html.includes('Iniciar Sesión'), 'Debe ofrecer iniciar sesión')
})

test('TournamentRegistrationModal: paid tournament shows presencial payment notice', () => {
  const html = renderToStaticMarkup(
    <TournamentRegistrationModal
      isOpen={true}
      onClose={noop}
      tournament={paidTournament}
      session={{ email: 'socio@club.com', name: 'Socio' }}
    />,
  )

  assert.ok(
    html.includes('Inscripción con pago presencial'),
    'Debe avisar que el pago es presencial',
  )
})

test('TournamentRegistrationModal: full tournament reports no availability', () => {
  const html = renderToStaticMarkup(
    <TournamentRegistrationModal
      isOpen={true}
      onClose={noop}
      tournament={{ ...freeTournament, cuposDisponibles: 0, cuposOcupados: 16 }}
      session={{ email: 'socio@club.com', name: 'Socio' }}
    />,
  )

  assert.ok(html.includes('aforo máximo'), 'Debe informar que el aforo está completo')
})
