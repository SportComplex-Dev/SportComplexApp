import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

;(global as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { React: typeof React }).React = React

import { renderToStaticMarkup } from 'react-dom/server'
import {
  AdminMembershipsView,
  type AdminMembershipOverviewData,
} from '@sportcomplex/features-admin'

const mockData: AdminMembershipOverviewData = {
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
    ],
    expired: [
      {
        id: 'usr-004',
        nombre: 'Sofia Martinez',
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

test('TSK-FE-29 / HU-35: AdminMembershipsView renderiza KPIs, tabs y tabla con datos', () => {
  const html = renderToStaticMarkup(
    <AdminMembershipsView data={mockData} isLoading={false} />
  )

  // Debe contener el contenedor principal y KPIs
  assert.ok(html.includes('data-testid="admin-memberships-view"'))
  assert.ok(html.includes('data-testid="kpi-active-members"'))
  assert.ok(html.includes('data-testid="kpi-renewal-rate"'))
  assert.ok(html.includes('data-testid="kpi-new-members"'))
  assert.ok(html.includes('data-testid="kpi-none-members"'))

  // Valores de KPIs
  assert.ok(html.includes('75.5%'), 'Debe mostrar la tasa de renovación')
  assert.ok(html.includes('Socios Activos'))

  // Tabs segmentados
  assert.ok(html.includes('data-testid="tab-active"'))
  assert.ok(html.includes('data-testid="tab-none"'))
  assert.ok(html.includes('data-testid="tab-expired"'))

  // Buscador y tabla
  assert.ok(html.includes('data-testid="search-input"'))
  assert.ok(html.includes('data-testid="memberships-table"'))

  // Miembro activo inicial en la tabla
  assert.ok(html.includes('Carlos Perez'))
})

test('TSK-FE-29 / HU-35: AdminMembershipsView muestra estado de carga cuando isLoading es true', () => {
  const html = renderToStaticMarkup(
    <AdminMembershipsView data={null} isLoading={true} />
  )

  assert.ok(html.includes('Cargando segmentación de membresías...'))
})
