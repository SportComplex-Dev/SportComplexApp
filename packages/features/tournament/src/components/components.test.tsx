import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TournamentStatusBadge,
  InscriptionStatusBadge,
  tournamentConfig,
  inscripcionConfig,
  TournamentFormModal,
  toDatetimeLocal,
  parseDatetimeLocalToUtcIso,
  mapTournamentApiError,
  TournamentDetailModal,
  TournamentRegistrationModal,
  PublicTournamentDetailModal,
} from './index'
import { Modal, ActionButton } from '@sportcomplex/ui'

import * as ComponentExports from './index'

test('packages/features/tournament/components exports all 5 core tournament components and helpers', () => {
  // 1. TournamentStatusBadge & InscriptionStatusBadge
  assert.equal(typeof TournamentStatusBadge, 'function')
  assert.equal(typeof InscriptionStatusBadge, 'function')
  assert.ok(tournamentConfig)
  assert.ok(inscripcionConfig)

  // 2. TournamentFormModal & helpers
  assert.equal(typeof TournamentFormModal, 'function')
  assert.equal(typeof toDatetimeLocal, 'function')
  assert.equal(typeof parseDatetimeLocalToUtcIso, 'function')
  assert.equal(typeof mapTournamentApiError, 'function')

  // 3. TournamentDetailModal
  assert.equal(typeof TournamentDetailModal, 'function')

  // 4. TournamentRegistrationModal
  assert.equal(typeof TournamentRegistrationModal, 'function')

  // 5. PublicTournamentDetailModal
  assert.equal(typeof PublicTournamentDetailModal, 'function')

  // Common UI wrappers
  assert.equal(typeof Modal, 'function')
  assert.equal(typeof ActionButton, 'function')
})

test('verifies individual component module exports', async () => {
  const badgeModule = await import('./gestion/TournamentStatusBadge')
  assert.equal(typeof badgeModule.TournamentStatusBadge, 'function')
  assert.equal(typeof badgeModule.InscriptionStatusBadge, 'function')

  const formModalModule = await import('./gestion/TournamentFormModal')
  assert.equal(typeof formModalModule.TournamentFormModal, 'function')

  const detailModalModule = await import('./detalle/TournamentDetailModal')
  assert.equal(typeof detailModalModule.TournamentDetailModal, 'function')

  const regModalModule = await import('./inscripcion/TournamentRegistrationModal')
  assert.equal(typeof regModalModule.TournamentRegistrationModal, 'function')

  const publicDetailModalModule = await import('./detalle/PublicTournamentDetailModal')
  assert.equal(typeof publicDetailModalModule.PublicTournamentDetailModal, 'function')
})

test('verifies no phantom components are exported', () => {
  const exportKeys = Object.keys(ComponentExports)
  assert.ok(!exportKeys.includes('TournamentCard'), 'Must not export phantom TournamentCard')
  assert.ok(!exportKeys.includes('TournamentList'), 'Must not export phantom TournamentList')
  assert.ok(!exportKeys.includes('BracketView'), 'Must not export phantom BracketView')
  assert.ok(!exportKeys.includes('useTournament'), 'Must not export phantom useTournament')
  assert.ok(!exportKeys.includes('useRegistration'), 'Must not export phantom useRegistration')
  assert.ok(!exportKeys.includes('useBracket'), 'Must not export phantom useBracket')
})


