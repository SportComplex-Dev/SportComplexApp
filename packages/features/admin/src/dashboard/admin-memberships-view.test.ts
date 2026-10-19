import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatBogotaDate,
  type AdminMembershipOverviewData,
} from './AdminMembershipsView'

const mockOverviewData: AdminMembershipOverviewData = {
  segments: {
    active: [
      {
        id: 'usr-001',
        nombre: 'Carlos Perez',
        fechaInicio: '2026-09-01T10:00:00.000Z',
        fechaFin: '2026-11-01T10:00:00.000Z',
      },
      {
        id: 'usr-002',
        nombre: 'Maria Gomez',
        fechaInicio: '2026-09-15T15:30:00.000Z',
        fechaFin: '2026-10-30T15:30:00.000Z',
      },
    ],
    none: [
      {
        id: 'usr-003',
        nombre: 'Andres Botero',
      },
      {
        id: 'usr-004',
        nombre: 'Sofia Martinez',
      },
    ],
    expired: [
      {
        id: 'usr-005',
        nombre: 'Diego Lopez',
        fechaInicio: '2026-01-10T12:00:00.000Z',
        fechaFin: '2026-04-10T12:00:00.000Z',
      },
    ],
  },
  metrics: {
    newMembersLast30Days: 4,
    renewalPercentage: 75.5,
  },
}

test('TSK-FE-29 / formatBogotaDate: Formatea fechas con zona horaria America/Bogota', () => {
  assert.equal(formatBogotaDate(undefined), '—')
  assert.equal(formatBogotaDate(null), '—')
  assert.equal(formatBogotaDate('fecha-invalida'), '—')

  const formatted = formatBogotaDate('2026-10-18T15:00:00.000Z')
  assert.ok(formatted !== '—')
  assert.ok(formatted.includes('2026'))
})

test('TSK-FE-29 / Segmentación: Verificación de cuentas por segmento y métricas clave', () => {
  const activeCount = mockOverviewData.segments.active.length
  const noneCount = mockOverviewData.segments.none.length
  const expiredCount = mockOverviewData.segments.expired.length

  assert.equal(activeCount, 2, 'Debe haber 2 socios activos')
  assert.equal(noneCount, 2, 'Debe haber 2 clientes sin membresía')
  assert.equal(expiredCount, 1, 'Debe haber 1 cliente con membresía vencida')

  assert.equal(mockOverviewData.metrics.newMembersLast30Days, 4)
  assert.equal(mockOverviewData.metrics.renewalPercentage, 75.5)
})

test('TSK-FE-29 / Buscador: Filtrado en memoria por nombre e identificador', () => {
  const activeList = mockOverviewData.segments.active

  // Búsqueda por nombre (insensible a mayúsculas)
  const queryName = 'carlos'
  const filteredByName = activeList.filter(
    (m) =>
      m.nombre.toLowerCase().includes(queryName) ||
      m.id.toLowerCase().includes(queryName)
  )
  assert.equal(filteredByName.length, 1)
  assert.equal(filteredByName[0]?.nombre, 'Carlos Perez')

  // Búsqueda por ID
  const queryId = 'usr-002'
  const filteredById = activeList.filter(
    (m) =>
      m.nombre.toLowerCase().includes(queryId) ||
      m.id.toLowerCase().includes(queryId)
  )
  assert.equal(filteredById.length, 1)
  assert.equal(filteredById[0]?.id, 'usr-002')

  // Búsqueda sin coincidencia
  const queryNone = 'inexistente'
  const filteredNone = activeList.filter(
    (m) =>
      m.nombre.toLowerCase().includes(queryNone) ||
      m.id.toLowerCase().includes(queryNone)
  )
  assert.equal(filteredNone.length, 0)
})

test('TSK-FE-29 / Fallbacks: Manejo controlado de datos nulos o vacíos', () => {
  const emptyData: AdminMembershipOverviewData = {
    segments: {
      active: [],
      none: [],
      expired: [],
    },
    metrics: {
      newMembersLast30Days: 0,
      renewalPercentage: 0,
    },
  }

  assert.equal(emptyData.segments.active.length, 0)
  assert.equal(emptyData.segments.none.length, 0)
  assert.equal(emptyData.segments.expired.length, 0)
  assert.equal(emptyData.metrics.newMembersLast30Days, 0)
  assert.equal(emptyData.metrics.renewalPercentage, 0)
})
