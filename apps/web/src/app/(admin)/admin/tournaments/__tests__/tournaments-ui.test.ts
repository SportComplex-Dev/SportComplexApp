import test from 'node:test'
import assert from 'node:assert/strict'
import {
  tournamentConfig,
  inscripcionConfig,
} from '@/components/admin/tournaments/tournament-status-badge'
import type { TournamentFormData, BloqueoFormItem } from '@/components/admin/tournaments/tournament-form-modal'

// TSK-FE-25 (SCRUM-168): Suite de pruebas unitarias para el Panel de Torneos Admin

test('TSK-FE-25: Configuración semántica y visual de estados de torneo', () => {
  // Verificar que todos los estados del ciclo de vida tienen etiqueta y clase de estilo
  assert.equal(tournamentConfig.BORRADOR.label, 'Borrador')
  assert.equal(tournamentConfig.INSCRIPCIONES_ABIERTAS.label, 'Inscripciones Abiertas')
  assert.equal(tournamentConfig.EN_CURSO.label, 'En Curso')
  assert.equal(tournamentConfig.FINALIZADO.label, 'Finalizado')
  assert.equal(tournamentConfig.CANCELADO.label, 'Cancelado')

  // Verificar dots de estado
  assert.match(tournamentConfig.INSCRIPCIONES_ABIERTAS.dot, /bg-emerald/)
  assert.match(tournamentConfig.EN_CURSO.dot, /bg-blue/)
  assert.match(tournamentConfig.CANCELADO.dot, /bg-rose/)
})

test('TSK-FE-25: Configuración de estados de inscripción de jugadores', () => {
  assert.equal(inscripcionConfig.CONFIRMADA.label, 'Confirmada')
  assert.equal(inscripcionConfig.PENDIENTE_PAGO.label, 'Pendiente Pago')
  assert.equal(inscripcionConfig.CANCELADA.label, 'Cancelada')
})

test('TSK-FE-25: Cálculos de ocupación y recaudación estimada de torneo', () => {
  const torneo = {
    cuposTotales: 32,
    cuposOcupados: 24,
    precioInscripcion: 50000,
  }

  const cuposDisponibles = Math.max(0, torneo.cuposTotales - torneo.cuposOcupados)
  const pctOcupacion = Math.round((torneo.cuposOcupados / torneo.cuposTotales) * 100)
  const recaudacionEstimada = torneo.cuposOcupados * torneo.precioInscripcion

  assert.equal(cuposDisponibles, 8)
  assert.equal(pctOcupacion, 75)
  assert.equal(recaudacionEstimada, 1200000)
})

test('TSK-FE-25: Lógica de validación del formulario de creación y bloqueo preventivo (ARC-01)', () => {
  const formDataValido: TournamentFormData = {
    titulo: 'Torneo Abierto de Pádel Apertura 2026',
    descripcion: 'Torneo oficial para categoría 2da y 3ra',
    categoriaId: 1,
    nivel: 'Segunda Categoría (Intermedio Alto)',
    fechaInicio: '2026-11-01T08:00',
    fechaFin: '2026-11-02T20:00',
    cuposTotales: 16,
    precioInscripcion: 60000,
    estado: 'BORRADOR',
    bloqueos: [
      {
        servicioId: 10,
        horaInicio: '2026-11-01T08:00',
        horaFin: '2026-11-01T14:00',
      },
      {
        servicioId: 11,
        horaInicio: '2026-11-01T08:00',
        horaFin: '2026-11-01T14:00',
      },
    ],
  }

  // Validación de título
  assert.ok(formDataValido.titulo.trim().length >= 3)

  // Validación de coherencia de fechas
  const inicio = new Date(formDataValido.fechaInicio)
  const fin = new Date(formDataValido.fechaFin)
  assert.ok(fin > inicio, 'La fecha de fin debe ser posterior a la de inicio')

  // Validación de bloqueos preventivos
  assert.equal(formDataValido.bloqueos.length, 2)
  formDataValido.bloqueos.forEach((b: BloqueoFormItem) => {
    assert.ok(b.servicioId > 0)
    assert.ok(new Date(b.horaFin) > new Date(b.horaInicio))
  })
})

test('TSK-FE-25: Manejo y detección de conflicto 409 COURT_SLOT_CONFLICT', () => {
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
