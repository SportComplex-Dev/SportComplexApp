'use client'

import { Activity, BarChart3 } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'

export interface BreakdownItem {
  periodKey: string
  periodLabel: string
  revenue: number
  attendance: number
  spotsSold?: number
}

interface DashboardChartsProps {
  period: 'daily' | 'weekly'
  breakdownItems: BreakdownItem[]
  maxAttendance: number
  maxRevenue: number
  totalAttendance: number
  totalRevenue: number
  formatMoney: (val: number) => string
}

export function DashboardCharts({
  period,
  breakdownItems,
  maxAttendance,
  maxRevenue,
  totalAttendance,
  totalRevenue,
  formatMoney,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico 1: Afluencia Temporal (Asistencia en Puerta) */}
      <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <Activity size={16} className="text-blue-500" /> Afluencia de Tiquetes por Periodo
            </h3>
            <p className="text-[11px] text-[var(--subtle)]">Validaciones registradas en molinete y torniquete</p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {period === 'daily' ? 'Puntos Diarios' : 'Puntos Semanales'}
          </Badge>
        </div>

        {/* SVG Chart de Barras Interactivas de Asistencia */}
        <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-[var(--line)]">
          {breakdownItems.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--subtle)]">
              Sin datos en el rango seleccionado
            </div>
          ) : (
            breakdownItems.map((item, idx) => {
              const heightPct = item.attendance === 0 ? 0 : Math.max(4, (item.attendance / maxAttendance) * 100)
              return (
                <div
                  key={item.periodKey || idx}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                >
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--ink)] text-[var(--surface)] text-[10px] font-bold py-1 px-2 rounded-md shadow-lg pointer-events-none z-10 whitespace-nowrap">
                    {item.periodLabel}: {item.attendance} accesos
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-blue-500/80 group-hover:bg-blue-500 transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9.5px] text-[var(--subtle)] mt-1.5 truncate max-w-full">
                    {item.periodLabel}
                  </span>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between pt-2 text-[11px] text-[var(--subtle)]">
          <span>Máximo en periodo: {maxAttendance} accesos</span>
          <span>Total: {totalAttendance} validados</span>
        </div>
      </div>

      {/* Gráfico 2: Recaudación Monetaria por Periodo */}
      <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
              <BarChart3 size={16} className="text-emerald-500" /> Ingresos Vía Stripe por Periodo
            </h3>
            <p className="text-[11px] text-[var(--subtle)]">Cifras cuadradas contra la tabla transaccional de pagos</p>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {formatMoney(totalRevenue)}
          </span>
        </div>

        {/* SVG Chart de Barras de Ingresos */}
        <div className="h-48 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-[var(--line)]">
          {breakdownItems.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--subtle)]">
              Sin datos en el rango seleccionado
            </div>
          ) : (
            breakdownItems.map((item, idx) => {
              const heightPct = item.revenue === 0 ? 0 : Math.max(4, (item.revenue / maxRevenue) * 100)
              return (
                <div
                  key={item.periodKey || idx}
                  className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                >
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--ink)] text-[var(--surface)] text-[10px] font-bold py-1 px-2 rounded-md shadow-lg pointer-events-none z-10 whitespace-nowrap">
                    {formatMoney(item.revenue)}
                  </div>
                  <div
                    className="w-full rounded-t-lg bg-emerald-500/80 group-hover:bg-emerald-500 transition-all duration-300"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9.5px] text-[var(--subtle)] mt-1.5 truncate max-w-full">
                    {item.periodLabel}
                  </span>
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center justify-between pt-2 text-[11px] text-[var(--subtle)]">
          <span>Pico: {formatMoney(maxRevenue)}</span>
          <span>Total ingresos: {formatMoney(totalRevenue)}</span>
        </div>
      </div>
    </div>
  )
}
