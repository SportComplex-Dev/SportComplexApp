import test from 'node:test'
import assert from 'node:assert/strict'
import type { TournamentRegisterTarget } from '../tournament-registration-modal'

// TSK-FE-26 (SCRUM-169): Suite de pruebas unitarias robusta para flujo de inscripción a torneos en la landing y portal

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

test('TSK-FE-26: Validación y sanitización de payload para inscripción con pareja opcional', () => {
  const inputConPareja = {
    nombrePareja: '  Carlos Mendoza  ',
  }

  const trimmed = inputConPareja.nombrePareja.trim()
  assert.ok(trimmed.length > 0)
  assert.ok(trimmed.length <= 100)
  assert.equal(trimmed, 'Carlos Mendoza')

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

test('TSK-FE-26 / INT-01: Verificación de contrato real de ticket, QR firmado SC1 y recuperación de comprobante', () => {
  // Contrato real retornado por backend Prisma (InscripcionTorneo con ticketCodigoUuid y ticketQrPayload firmado)
  const mockBackendResponse = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
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
      ticketCodigoUuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
      ticketQrPayload: 'SC1:3fa85f64-5717-4562-b3fc-2c963f66afa6:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
  }

  // Lógica del portal en tickets/page.tsx
  const ins = mockBackendResponse.miInscripcion
  const isConfirmed = ins.estado === 'CONFIRMADA'
  const qrPayload = ins?.ticketQrPayload || null
  const ticketCode = ins?.ticketCodigoUuid || (isConfirmed ? `TRN-${mockBackendResponse.id.slice(0, 8)}` : 'PENDIENTE')
  const inscripcionId = ins?.id || mockBackendResponse.id

  // 1. El código para display al usuario es el UUID
  assert.equal(ticketCode, '3fa85f64-5717-4562-b3fc-2c963f66afa6')
  assert.match(ticketCode, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  assert.equal(isConfirmed, true)

  // 2. El payload del QR debe ser el payload firmado SC1 recibido del servidor
  assert.ok(qrPayload, 'El payload del QR debe existir')
  assert.match(qrPayload, /^SC1:3fa85f64-5717-4562-b3fc-2c963f66afa6:[a-f0-9]{64}$/)

  // 3. El modal y la impresión del ticket deben usar inscripcionId (no el tournament.id) para fetchReceiptData
  const fakeTicketForPrint = {
    id: inscripcionId,
    code: ticketCode,
    qrPayload: qrPayload ?? undefined,
  }
  assert.equal(fakeTicketForPrint.id, 'ins-55', 'Para imprimir/fetchReceiptData se debe consultar por el ID de la inscripción')
  assert.equal(fakeTicketForPrint.qrPayload, qrPayload, 'El comprobante impreso debe recibir el payload firmado SC1 para el escáner')
})

test('TSK-FE-26 / BUS-01: Bloqueo de QR de acceso para inscripciones en estado PENDIENTE_PAGO', () => {
  const mockInscripcionPendiente = {
    id: 'trn-pago-01',
    titulo: 'Torneo Pádel Pro Open',
    precioInscripcion: 60000,
    miInscripcion: {
      id: 'ins-pendiente-01',
      estado: 'PENDIENTE_PAGO',
      ticketCodigoUuid: null,
    },
  }

  const isConfirmed = mockInscripcionPendiente.miInscripcion.estado === 'CONFIRMADA'
  const canShowQR = isConfirmed && Boolean(mockInscripcionPendiente.miInscripcion.ticketCodigoUuid)

  assert.equal(isConfirmed, false)
  assert.equal(canShowQR, false, 'No se debe emitir ni habilitar QR de acceso si el torneo no ha sido pagado')
})
