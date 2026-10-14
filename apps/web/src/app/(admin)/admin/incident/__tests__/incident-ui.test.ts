import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calcularImpactoContingencia,
  formatIncidentDate,
  formatIncidentHour,
  isIncidentReasonValid,
} from '@/app/(admin)/admin/incident/incident-utils'

test('TSK-FE-22 / HIGH-01: formatIncidentDate preserva la fecha exacta sin desfase off-by-one (America/Bogota UTC-5)', () => {
  // En PostgreSQL/Prisma, @db.Date se serializa como medianoche UTC
  const isoDate = '2026-10-12T00:00:00.000Z'
  const formatted = formatIncidentDate(isoDate)

  assert.ok(
    formatted.includes('12'),
    `La fecha formateada debe contener el día 12, recibido: "${formatted}"`,
  )
  assert.ok(
    formatted.includes('oct'),
    `La fecha formateada debe contener el mes de octubre, recibido: "${formatted}"`,
  )

  // Objeto Date equivalente
  const dateObj = new Date('2026-10-12T00:00:00.000Z')
  assert.ok(formatIncidentDate(dateObj).includes('12'))

  // Manejo de valores vacíos o nulos
  assert.equal(formatIncidentDate(null), '')
  assert.equal(formatIncidentDate(undefined), '')
  assert.equal(formatIncidentDate(''), '')
})

test('TSK-FE-22 / HIGH-01: formatIncidentHour preserva la hora de la franja sin desfase de 5 horas', () => {
  // En PostgreSQL/Prisma, @db.Time se serializa como timestamp UTC de 1970
  const isoTime = '1970-01-01T10:00:00.000Z'
  const formatted = formatIncidentHour(isoTime)

  // Debe preservar las 10:00 (no 05:00 AM)
  assert.ok(
    formatted.includes('10:00'),
    `La hora formateada debe ser las 10:00, recibido: "${formatted}"`,
  )

  // String directo '15:30:00'
  assert.equal(formatIncidentHour('15:30:00'), '15:30')
  assert.equal(formatIncidentHour('08:00'), '08:00')

  // Manejo de valores vacíos
  assert.equal(formatIncidentHour(null), '')
  assert.equal(formatIncidentHour(undefined), '')
  assert.equal(formatIncidentHour(''), '')
})

test('TSK-FE-22: isIncidentReasonValid valida longitud y sanitiza espacios', () => {
  assert.equal(isIncidentReasonValid('ab'), false, 'Menos de 3 caracteres debe ser inválido')
  assert.equal(isIncidentReasonValid('   ab   '), false, 'Espacios en blanco no deben contar')
  assert.equal(isIncidentReasonValid('abc'), true, '3 caracteres exactos es válido')
  assert.equal(isIncidentReasonValid('Corte imprevisto de suministro de agua'), true)

  const maxReason = 'a'.repeat(255)
  assert.equal(isIncidentReasonValid(maxReason), true, '255 caracteres es válido')

  const tooLongReason = 'a'.repeat(256)
  assert.equal(isIncidentReasonValid(tooLongReason), false, '256 caracteres excede el límite')
})

test('TSK-FE-22 / Criterio Clave: calcularImpactoContingencia contabiliza clientes únicos y cupos correctamente', () => {
  const reservas = [
    { usuarioId: 'user-1', cantidadCupos: 2 },
    { usuarioId: 'user-1', cantidadCupos: 1 }, // Mismo usuario con otra reserva
    { usuarioId: 'user-2', cantidadCupos: 4 },
  ]

  const impacto = calcularImpactoContingencia(reservas)

  assert.equal(impacto.totalReservas, 3, 'Debe haber 3 reservas en total')
  assert.equal(impacto.totalCupos, 7, 'Debe totalizar 2 + 1 + 4 = 7 cupos')
  assert.equal(
    impacto.totalClientesAfectados,
    2,
    'Debe contar 2 clientes únicos afectados (user-1 y user-2)',
  )

  const vacio = calcularImpactoContingencia([])
  assert.equal(vacio.totalReservas, 0)
  assert.equal(vacio.totalCupos, 0)
  assert.equal(vacio.totalClientesAfectados, 0)
})
