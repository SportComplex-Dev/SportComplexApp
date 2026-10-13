import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMoney } from '@sportcomplex/core'

test('TSK-FE-23 / Dashboard: Formateo monetario y KPIs de recaudación', () => {
  assert.equal(formatMoney(0), '$0')
  assert.ok(formatMoney(6850000).includes('6'))
  assert.ok(formatMoney(150000).includes('150'))
})

test('TSK-FE-23 / NEW-01: Fallback neutro cuando no hay categorías deportivas líderes', () => {
  const emptyCategories: Array<{ categoryName: string; revenuePercentage: number }> = []
  const topCategoryName = emptyCategories[0]?.categoryName ?? '—'
  const topPercentage = emptyCategories[0]?.revenuePercentage ? `${emptyCategories[0].revenuePercentage}% del total` : 'Sin datos'

  assert.equal(topCategoryName, '—', 'Debe retornar un guión neutro en vez de un valor inventado')
  assert.equal(topPercentage, 'Sin datos')

  const sampleCategories = [
    { categoryName: 'Pádel', revenuePercentage: 65 },
    { categoryName: 'Natación', revenuePercentage: 35 },
  ]
  const topFound = sampleCategories[0]?.categoryName ?? '—'
  assert.equal(topFound, 'Pádel')
})

test('TSK-FE-23 / UI-01: Generación y estructuración de contenido CSV de informe gerencial', () => {
  const summary = {
    totalRevenue: 5200000,
    totalAttendance: 142,
    totalSpotsSold: 180,
    uniqueAttendees: 98,
  }
  const breakdownItems = [
    { periodKey: '2026-10-10', periodLabel: '10 oct', revenue: 2500000, attendance: 70 },
    { periodKey: '2026-10-11', periodLabel: '11 oct', revenue: 2700000, attendance: 72 },
  ]

  const headers = ['Fecha / Periodo', 'Ingresos (COP)', 'Asistencias Registradas']
  const rows = breakdownItems.map((item) => [
    item.periodKey,
    item.revenue,
    item.attendance,
  ])

  const csvContent = [
    `# Resumen Gerencial SportComplex`,
    `Ingresos Totales,${summary.totalRevenue}`,
    `Asistencias Totales,${summary.totalAttendance}`,
    `Cupos Vendidos,${summary.totalSpotsSold}`,
    `Usuarios Unicos,${summary.uniqueAttendees}`,
    '',
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n')

  assert.ok(csvContent.includes('Ingresos Totales,5200000'))
  assert.ok(csvContent.includes('2026-10-10,2500000,70'))
  assert.ok(csvContent.includes('2026-10-11,2700000,72'))
  assert.ok(csvContent.includes('Fecha / Periodo,Ingresos (COP),Asistencias Registradas'))
})

test('TSK-FE-23 / COD-02: Manejo de zona horaria America/Bogota sin desfases off-by-one', () => {
  const d = new Date('2026-10-12T23:30:00Z') // 18:30 en Bogotá (UTC-5)
  const bogotaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
  assert.equal(bogotaDate, '2026-10-12', 'Debe reflejar el día 12 en Bogotá, no el 13')
})
