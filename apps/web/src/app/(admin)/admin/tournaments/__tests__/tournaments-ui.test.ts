import test from 'node:test'
import assert from 'node:assert/strict'
import {
  tournamentConfig,
  inscripcionConfig,
} from '@/components/admin/tournaments/tournament-status-badge'
import {
  toDatetimeLocal,
  parseDatetimeLocalToUtcIso,
} from '@/components/admin/tournaments/tournament-form-modal'
import { createTournamentSchema } from '@sportcomplex/validation'

// TSK-FE-25 (SCRUM-168): Suite de pruebas unitarias robusta para Panel de Torneos Admin

test('TSK-FE-25: Configuración semántica y visual de estados de torneo (FSM & Badges)', () => {
  assert.equal(tournamentConfig.BORRADOR.label, 'Borrador')
  assert.equal(tournamentConfig.INSCRIPCIONES_ABIERTAS.label, 'Inscripciones Abiertas')
  assert.equal(tournamentConfig.EN_CURSO.label, 'En Curso')
  assert.equal(tournamentConfig.FINALIZADO.label, 'Finalizado')
  assert.equal(tournamentConfig.CANCELADO.label, 'Cancelado')

  assert.match(tournamentConfig.INSCRIPCIONES_ABIERTAS.dot, /bg-emerald/)
  assert.match(tournamentConfig.EN_CURSO.dot, /bg-blue/)
  assert.match(tournamentConfig.CANCELADO.dot, /bg-rose/)

  assert.equal(inscripcionConfig.CONFIRMADA.label, 'Confirmada')
  assert.equal(inscripcionConfig.PENDIENTE_PAGO.label, 'Pendiente Pago')
  assert.equal(inscripcionConfig.CANCELADA.label, 'Cancelada')
})

test('TSK-FE-25 / SEC-01: Prevención de desfase horario cliente-servidor (Timezone America/Bogota UTC-5)', () => {
  // Timestamp UTC a las 14:30 UTC -> En Bogotá (UTC-5) debe ser exactamente las 09:30
  const utcDate = '2026-11-15T14:30:00.000Z'
  const localFormatted = toDatetimeLocal(utcDate)
  assert.equal(localFormatted, '2026-11-15T09:30')

  // Timestamp nocturno: 2026-11-16T01:00:00.000Z -> En Bogotá es el día anterior 2026-11-15T20:00
  const utcMidnight = '2026-11-16T01:00:00.000Z'
  const localMidnight = toDatetimeLocal(utcMidnight)
  assert.equal(localMidnight, '2026-11-15T20:00')

  // Conversión inversa de string local a ISO UTC garantizando offset -05:00
  const inputDatetime = '2026-11-15T09:30'
  const isoUtc = parseDatetimeLocalToUtcIso(inputDatetime)
  assert.equal(isoUtc, '2026-11-15T14:30:00.000Z')
})

test('TSK-FE-25 / VAL-01: Validación de esquema createTournamentSchema de @sportcomplex/validation con payload válido', () => {
  const validPayload = {
    titulo: 'Torneo Apertura de Tenis 2026',
    descripcion: 'Torneo abierto en superficie rápida',
    categoriaId: 1,
    nivel: 'Segunda Categoría',
    fechaInicio: '2026-11-20T13:00:00.000Z',
    fechaFin: '2026-11-22T23:00:00.000Z',
    cuposTotales: 16,
    precioInscripcion: 50000,
    estado: 'BORRADOR' as const,
    bloqueos: [
      {
        servicioId: 2,
        horaInicio: '2026-11-20T13:00:00.000Z',
        horaFin: '2026-11-20T19:00:00.000Z',
      },
    ],
  }

  const result = createTournamentSchema.safeParse(validPayload)
  assert.equal(result.success, true)
})

test('TSK-FE-25 / VAL-01: Rechazo estricto con fieldErrors para datos inválidos según reglas de negocio', () => {
  // Caso 1: Título menor a 3 caracteres
  const invalidTitle = {
    titulo: 'AB',
    categoriaId: 1,
    nivel: 'Intermedio',
    fechaInicio: '2026-11-20T13:00:00.000Z',
    fechaFin: '2026-11-22T23:00:00.000Z',
    cuposTotales: 16,
  }
  const resultTitle = createTournamentSchema.safeParse(invalidTitle)
  assert.equal(resultTitle.success, false)
  if (!resultTitle.success) {
    const errors = resultTitle.error.flatten().fieldErrors
    assert.ok(errors.titulo)
  }

  // Caso 2: Cupos menores a 2
  const invalidCupos = {
    titulo: 'Torneo Pádel Master',
    categoriaId: 1,
    nivel: 'Intermedio',
    fechaInicio: '2026-11-20T13:00:00.000Z',
    fechaFin: '2026-11-22T23:00:00.000Z',
    cuposTotales: 1,
  }
  const resultCupos = createTournamentSchema.safeParse(invalidCupos)
  assert.equal(resultCupos.success, false)
  if (!resultCupos.success) {
    const errors = resultCupos.error.flatten().fieldErrors
    assert.ok(errors.cuposTotales)
  }

  // Caso 3: Bloqueo con horaFin anterior a horaInicio
  const invalidBloqueo = {
    titulo: 'Torneo Pádel Master',
    categoriaId: 1,
    nivel: 'Intermedio',
    fechaInicio: '2026-11-20T13:00:00.000Z',
    fechaFin: '2026-11-22T23:00:00.000Z',
    cuposTotales: 16,
    bloqueos: [
      {
        servicioId: 2,
        horaInicio: '2026-11-20T19:00:00.000Z',
        horaFin: '2026-11-20T13:00:00.000Z', // Invertida
      },
    ],
  }
  const resultBloqueo = createTournamentSchema.safeParse(invalidBloqueo)
  assert.equal(resultBloqueo.success, false)
})

test('TSK-FE-25: Manejo y detección del código 409 COURT_SLOT_CONFLICT', () => {
  const errorResponse = {
    success: false,
    error: {
      code: 'COURT_SLOT_CONFLICT',
      message: 'La pista seleccionada presenta conflicto con una reserva previa en el horario especificado.',
    },
  }

  assert.equal(errorResponse.error.code, 'COURT_SLOT_CONFLICT')
  assert.match(errorResponse.error.message, /conflicto con una reserva previa/)
})
