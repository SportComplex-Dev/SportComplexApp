import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TournamentFormModal } from './TournamentFormModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).React = React

const categories = [
  { id: 1, nombre: 'Pádel' },
  { id: 2, nombre: 'Tenis' },
]
const services = [
  { id: 10, nombre: 'Pista Pádel 1', categoriaId: 1 },
  { id: 11, nombre: 'Cancha Tenis 1', categoriaId: 2 },
]
const noop = () => {}

test('TournamentFormModal: returns null when closed', () => {
  const html = renderToStaticMarkup(
    <TournamentFormModal
      isOpen={false}
      onClose={noop}
      categories={categories}
      services={services}
      onSaved={noop}
      notify={noop}
    />,
  )

  assert.equal(html, '', 'Debe retornar vacío cuando el modal está cerrado')
})

test('TournamentFormModal: renders create form with key fields when open', () => {
  const html = renderToStaticMarkup(
    <TournamentFormModal
      isOpen={true}
      onClose={noop}
      categories={categories}
      services={services}
      onSaved={noop}
      notify={noop}
    />,
  )

  assert.ok(html.includes('Crear Torneo Deportivo'), 'Debe mostrar el título de creación')
  assert.ok(html.includes('torneo-titulo'), 'Debe incluir el campo de título')
  assert.ok(html.includes('torneo-categoria'), 'Debe incluir el selector de categoría')
  assert.ok(html.includes('torneo-nivel'), 'Debe incluir el campo de nivel')
  assert.ok(html.includes('Bloqueo Preventivo de Pistas'), 'Debe incluir la sección de bloqueos')
  assert.ok(html.includes('Crear Torneo'), 'Debe incluir el botón de creación')
})

test('TournamentFormModal: renders edit title when tournamentToEdit is provided', () => {
  const html = renderToStaticMarkup(
    <TournamentFormModal
      isOpen={true}
      onClose={noop}
      tournamentToEdit={{ id: 't-1', titulo: 'Apertura 2026' }}
      categories={categories}
      services={services}
      onSaved={noop}
      notify={noop}
    />,
  )

  assert.ok(html.includes('Editar Torneo Deportivo'), 'Debe mostrar el título de edición')
  assert.ok(html.includes('Actualizar Torneo'), 'Debe incluir el botón de actualización')
})
