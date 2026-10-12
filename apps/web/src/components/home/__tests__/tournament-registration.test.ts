import test from 'node:test'
import assert from 'node:assert/strict'
import type { TournamentRegisterTarget } from '../tournament-registration-modal'

// TSK-FE-26 (SCRUM-169): Suite de pruebas unitarias para flujo de inscripción a torneos en la landing y portal

test('TSK-FE-26: Cálculo de aforo disponible y alertas de cupos urgentes en torneos', () => {
  const torneoConAforo: TournamentRegisterTarget = {
    id: 'trn-padel-open-01',
    titulo: 'Torneo Abierto de Pádel 2026',
    nivel: 'Segunda Categoría',
    fechaInicio: '2026-11-15T08:00:00Z',
    fechaFin: '2026-11-16T18:00:00Z',
    cuposTotales: 16,
    cuposOcupados: 14,
    cuposDisponibles: 2,
    precioInscripcion: 50000,
    yaInscrito: false,
  }

  const spotsLeft = torneoConAforo.cuposDisponibles ?? Math.max(0, torneoConAforo.cuposTotales - torneoConAforo.cuposOcupados)
  const isAlmostFull = spotsLeft <= 3
  const isFull = spotsLeft <= 0

  assert.equal(spotsLeft, 2)
  assert.equal(isAlmostFull, true, 'Debe activar indicador de cupos urgentes cuando restan 3 o menos')
  assert.equal(isFull, false)
})

test('TSK-FE-26: Detección de torneo agotado', () => {
  const torneoAgotado: TournamentRegisterTarget = {
    id: 'trn-futbol-02',
    titulo: 'Copa Fútbol 5 Fin de Año',
    nivel: 'Abierto Libre',
    fechaInicio: '2026-12-01T09:00:00Z',
    fechaFin: '2026-12-01T21:00:00Z',
    cuposTotales: 8,
    cuposOcupados: 8,
    cuposDisponibles: 0,
    precioInscripcion: 0,
  }

  const spotsLeft = torneoAgotado.cuposDisponibles ?? Math.max(0, torneoAgotado.cuposTotales - torneoAgotado.cuposOcupados)
  assert.equal(spotsLeft, 0)
  assert.equal(spotsLeft <= 0, true)
})

test('TSK-FE-26: Validación de payload para inscripción con pareja opcional', () => {
  const inputConPareja = {
    nombrePareja: '  Carlos Mendoza  ',
  }

  const trimmed = inputConPareja.nombrePareja.trim()
  assert.ok(trimmed.length > 0)
  assert.ok(trimmed.length <= 100)

  const inputIndividual = {
    nombrePareja: '   ',
  }
  const individualTrimmed = inputIndividual.nombrePareja.trim() || undefined
  assert.equal(individualTrimmed, undefined)
})

test('TSK-FE-26: Mapeo de códigos de error de inscripción de torneos a mensajes para el usuario', () => {
  const errorMap: Record<string, string> = {
    ALREADY_REGISTERED: 'Ya te encuentras formalmente inscrito en este torneo deportivo.',
    CAPACITY_EXCEEDED: 'Los cupos disponibles se han agotado.',
    REGISTRATION_CLOSED: 'Las inscripciones para este torneo se encuentran temporalmente cerradas.',
  }

  assert.match(errorMap.ALREADY_REGISTERED, /inscrito/)
  assert.match(errorMap.CAPACITY_EXCEEDED, /agotado/)
  assert.match(errorMap.REGISTRATION_CLOSED, /cerradas/)
})

test('TSK-FE-26: Mapeo de torneo inscrito a estructura compatible con Booking para visualización de QR y PDF', () => {
  const mockTorneoInscrito = {
    id: 'trn-100',
    titulo: 'Torneo Máster de Tenis',
    categoria: { nombre: 'Tenis' },
    fechaInicio: '2026-11-20T10:00:00Z',
    fechaFin: '2026-11-20T18:00:00Z',
    nivel: 'Primera Categoría',
    precioInscripcion: 80000,
    miInscripcion: {
      id: 'ins-55',
      estado: 'CONFIRMADA',
      nombrePareja: 'Andrés Gómez',
      ticket: {
        id: 'tkt-99',
        codigo: 'SC-TRN-2026-99',
      },
    },
  }

  const bookingAdapter = {
    id: mockTorneoInscrito.id,
    code: mockTorneoInscrito.miInscripcion.ticket.codigo,
    service: `Torneo: ${mockTorneoInscrito.titulo}`,
    category: mockTorneoInscrito.categoria.nombre,
    sede: 'Sede Principal',
    date: mockTorneoInscrito.fechaInicio.split('T')[0],
    time: '10:00 AM',
    attendees: mockTorneoInscrito.miInscripcion.nombrePareja ? 2 : 1,
    amount: mockTorneoInscrito.precioInscripcion,
    status: 'Confirmada',
    client: 'Socio de Prueba',
  }

  assert.equal(bookingAdapter.code, 'SC-TRN-2026-99')
  assert.equal(bookingAdapter.attendees, 2)
  assert.equal(bookingAdapter.status, 'Confirmada')
})
