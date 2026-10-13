'use client'

import React from 'react'
import { BarChart3, Building2, Download, Layers } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import type { CategoryPerformanceItem } from './dashboard-kpis'

export interface ServiceComparisonItem {
  serviceId: number
  serviceName: string
  modality: string
  totalSold: number
  totalUsed: number
  totalRevenue: number
}

interface DashboardTablesProps {
  categoryPerformance?: CategoryPerformanceItem[]
  servicesComparison?: ServiceComparisonItem[]
  handleExportCsv: () => void
  formatMoney: (val: number) => string
}

export function DashboardTables({
  categoryPerformance = [],
  servicesComparison = [],
  handleExportCsv,
  formatMoney,
}: DashboardTablesProps) {
  return (
    <div className="space-y-6">
      {/* Rendimiento por Categorías */}
      <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <Layers size={16} className="text-purple-500" /> Rendimiento por Categorías Deportivas
            </h3>
            <p className="text-[11px] text-[var(--subtle)]">Distribución de ingresos y volumen de reservas</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {categoryPerformance.length} Categorías
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categoryPerformance.map((cat) => (
            <div
              key={cat.categoryId}
              className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)]/50 hover:bg-[var(--surface-soft)] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-bold text-xs text-[var(--ink)] flex items-center gap-2">
                  <Building2 size={14} className="text-[var(--subtle)]" />
                  {cat.categoryName}
                </div>
                <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                  {formatMoney(cat.totalRevenue)}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--line)] h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full bg-[#557b53] dark:bg-[#8cd766] transition-all duration-500"
                  style={{ width: `${Math.min(100, cat.revenuePercentage)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--subtle)]">
                <span>{cat.totalBookings} reservas · {cat.totalSpotsSold} cupos</span>
                <span className="font-semibold text-[var(--ink)]">{cat.revenuePercentage}% del total</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabla Comparativa: Servicios Más Usados vs Más Vendidos (RNF-04) */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <BarChart3 size={16} className="text-[#557b53]" /> Comparativa: Servicios Más Usados vs. Más Vendidos
            </h3>
            <p className="text-[11px] text-[var(--subtle)]">
              Panel de alta densidad con índice de redención de entradas vendidas
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line)] text-xs font-semibold hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors cursor-pointer"
          >
            <Download size={13} /> Exportar informe
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[var(--surface-soft)] text-[var(--subtle)] font-bold uppercase text-[10px] tracking-wider border-b border-[var(--line)]">
              <tr>
                <th className="py-3 px-4">Servicio / Escenario</th>
                <th className="py-3 px-4">Modalidad</th>
                <th className="py-3 px-4 text-center">Cupos Vendidos</th>
                <th className="py-3 px-4 text-center">Cupos Usados (Puerta)</th>
                <th className="py-3 px-4 text-center">Tasa Redención</th>
                <th className="py-3 px-4 text-right">Recaudación Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {servicesComparison.map((serv) => {
                const redemptionRate =
                  serv.totalSold > 0 ? Math.round((serv.totalUsed / serv.totalSold) * 100) : 0

                return (
                  <tr key={serv.serviceId} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-[var(--ink)]">
                      {serv.serviceName}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={serv.modality === 'EXCLUSIVA' ? 'default' : 'secondary'} className="text-[10px]">
                        {serv.modality}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-[var(--ink)]">
                      {serv.totalSold}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-blue-600 dark:text-blue-400">
                      {serv.totalUsed}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          redemptionRate >= 90
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : redemptionRate >= 70
                              ? 'bg-blue-500/10 text-blue-600'
                              : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {redemptionRate}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-700 dark:text-emerald-400">
                      {formatMoney(serv.totalRevenue)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
