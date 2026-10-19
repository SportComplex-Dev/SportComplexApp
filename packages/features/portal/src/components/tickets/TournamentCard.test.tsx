import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TournamentCard } from './TournamentCard'
import type { UserTournamentItem } from '../../types/portal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const mockTournamentConfirmed: UserTournamentItem = {
  id: 'trn-uuid-1001-2026',
  titulo: 'Torneo Apertura Pádel 2026',
  descripcion: 'Torneo oficial categoría intermedia',
  nivel: 'Intermedio',
  categoria: { id: 1, nombre: 'Pádel Pro' },
  fechaInicio: '2026-11-15T09:00:00.000Z',
  fechaFin: '2026-11-17T18:00:00.000Z',
  precioInscripcion: 80000,
  miInscripcion: {
    id: 'ins-uuid-2001',
    estado: 'CONFIRMADA',
    nombrePareja: 'Mateo Gómez',
    ticketCodigoUuid: 'TRN-PADEL-01',
    ticketQrPayload: 'SC1:trn-uuid-1001-2026:abcdef',
  },
}

const mockTournamentPending: UserTournamentItem = {
  id: 'trn-uuid-1002-2026',
  titulo: 'Torneo Tenis Singles',
  descripcion: 'Torneo fin de semana',
  nivel: 'Avanzado',
  categoria: { id: 2, nombre: 'Tenis' },
  fechaInicio: '2026-11-20T10:00:00.000Z',
  fechaFin: '2026-11-22T19:00:00.000Z',
  precioInscripcion: 120000,
  miInscripcion: {
    id: 'ins-uuid-2002',
    estado: 'PENDIENTE_PAGO',
  },
}

const mockTournamentGratuito: UserTournamentItem = {
  id: 'trn-uuid-1003-2026',
  titulo: 'Torneo Relámpago Fútbol 5',
  nivel: 'Abierto',
  categoria: { id: 3, nombre: 'Fútbol' },
  fechaInicio: '2026-12-01T14:00:00.000Z',
  fechaFin: '2026-12-01T20:00:00.000Z',
  precioInscripcion: 0,
  miInscripcion: {
    id: 'ins-uuid-2003',
    estado: 'CONFIRMADA',
  },
}

test('TournamentCard: renders tournament details with confirmed status and action buttons', () => {
  const html = renderToStaticMarkup(
    <TournamentCard
      tournament={mockTournamentConfirmed}
      sessionName="Carlos Socio"
      onOpenQR={() => {}}
    />
  )

  // Verify tournament info
  assert.ok(html.includes('Torneo Apertura Pádel 2026'), 'Debe mostrar el título del torneo')
  assert.ok(html.includes('TRN-PADEL-01'), 'Debe mostrar el código del tiquete')
  assert.ok(html.includes('Nivel: Intermedio'), 'Debe mostrar el nivel del torneo')
  assert.ok(html.includes('Mateo Gómez'), 'Debe mostrar el nombre de la pareja')
  assert.ok(html.includes('Confirmada'), 'Debe mostrar el badge de confirmada')

  // Verify action buttons
  assert.ok(html.includes('Ver QR de Acceso'), 'Debe renderizar botón para ver QR')
  assert.ok(!html.includes('Imprimir'), 'El cliente no imprime tickets')
})

test('TournamentCard: renders pending payment status and notices correctly', () => {
  const html = renderToStaticMarkup(
    <TournamentCard
      tournament={mockTournamentPending}
      sessionName="Carlos Socio"
      onOpenQR={() => {}}
    />
  )

  assert.ok(html.includes('Torneo Tenis Singles'), 'Debe mostrar el título del torneo')
  assert.ok(html.includes('Pendiente Pago'), 'Debe mostrar badge de pendiente de pago')
  assert.ok(html.includes('Pago pendiente en taquilla'), 'Debe advertir sobre pago en taquilla')
  assert.ok(!html.includes('Ver QR de Acceso'), 'NO debe permitir ver QR sin confirmación')
})

test('TournamentCard: renders free tournament indicator and alternative statuses', () => {
  const html = renderToStaticMarkup(
    <TournamentCard
      tournament={mockTournamentGratuito}
      onOpenQR={() => {}}
    />
  )

  assert.ok(html.includes('Torneo Relámpago Fútbol 5'), 'Debe mostrar título del torneo gratuito')
  assert.ok(html.includes('Gratuito'), 'Debe mostrar etiqueta Gratuito cuando precio es 0')
  assert.ok(html.includes('Ver QR de Acceso'), 'Debe permitir ver QR al ser confirmada')

  // Test with other statuses like FINALIZADO or EN_CURSO
  const tournamentFinished: UserTournamentItem = {
    ...mockTournamentConfirmed,
    miInscripcion: {
      ...mockTournamentConfirmed.miInscripcion!,
      estado: 'FINALIZADO',
    },
  }

  const htmlFinished = renderToStaticMarkup(
    <TournamentCard
      tournament={tournamentFinished}
      onOpenQR={() => {}}
    />
  )
  assert.ok(htmlFinished.includes('Pendiente Pago'), 'Estado no confirmado entra en rama secundaria')
})
