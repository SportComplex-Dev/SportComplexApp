'use client'

import React from 'react'
import { DollarSign, UserCheck, Ticket, Layers, TrendingUp } from 'lucide-react'
import { Badge } from '@sportcomplex/ui'

export interface DashboardSummary {
  totalRevenue: number
  totalTransactions: number
  totalAttendance: number
  uniqueAttendees: number
  totalSpotsSold: number
  totalBookings: number
}

export interface CategoryPerformanceItem {
  categoryId: number
  categoryName: string
  totalRevenue: number
  revenuePercentage: number
  totalBookings: number
  totalSpotsSold: number
}

interface DashboardKPIsProps {
  summary?: DashboardSummary
  categoryPerformance?: CategoryPerformanceItem[]
  formatMoney: (val: number) => string
}

export function DashboardKPIs({
  summary,
  categoryPerformance,
  formatMoney,
}: DashboardKPIsProps) {
  const topCategory = categoryPerformance?.[0]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Recaudación Stripe */}
      <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Recaudación Stripe</span>
          <DollarSign size={18} className="p-0.5 rounded-md bg-emerald-500/10" />
        </div>
        <div className="text-2xl sm:text-3xl font-black mt-3 text-emerald-800 dark:text-emerald-300 tracking-tight">
          {formatMoney(summary?.totalRevenue ?? 0)}
        </div>
        <div className="text-[12px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 flex items-center justify-between">
          <span>{summary?.totalTransactions ?? 0} transacciones cobradas</span>
          <span className="font-bold flex items-center text-[11px]">
            <TrendingUp size={12} className="mr-0.5" /> 100% verificado
          </span>
        </div>
      </div>

      {/* KPI 2: Afluencia (Tiquetes Usados) */}
      <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Afluencia en Torniquete</span>
          <UserCheck size={18} className="p-0.5 rounded-md bg-blue-500/10" />
        </div>
        <div className="text-2xl sm:text-3xl font-black mt-3 text-blue-800 dark:text-blue-300 tracking-tight">
          {summary?.totalAttendance ?? 0}{' '}
          <small className="text-sm font-semibold opacity-75">tiquetes USADO</small>
        </div>
        <div className="text-[12px] text-blue-700/80 dark:text-blue-400/80 mt-1 flex items-center justify-between">
          <span>{summary?.uniqueAttendees ?? 0} usuarios únicos</span>
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
            Puerta RF-14
          </Badge>
        </div>
      </div>

      {/* KPI 3: Reservas & Cupos Vendidos */}
      <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-[var(--subtle)]">
          <span className="text-[11px] font-bold uppercase tracking-wider">Demanda & Cupos</span>
          <Ticket size={18} className="p-0.5 rounded-md bg-[var(--surface-soft)]" />
        </div>
        <div className="text-2xl sm:text-3xl font-black mt-3 text-[var(--ink)] tracking-tight">
          {summary?.totalSpotsSold ?? 0}{' '}
          <small className="text-sm font-semibold text-[var(--subtle)]">cupos vendidos</small>
        </div>
        <div className="text-[12px] text-[var(--subtle)] mt-1 flex items-center justify-between">
          <span>{summary?.totalBookings ?? 0} reservas emitidas</span>
          <span className="text-[11px] font-semibold text-[#4b7652] dark:text-[#9ee285]">
            {summary && summary.totalSpotsSold > 0
              ? `${Math.round((summary.totalAttendance / summary.totalSpotsSold) * 100)}% asistencia`
              : '0%'}
          </span>
        </div>
      </div>

      {/* KPI 4: Rendimiento de Categorías (NEW-01: fallback neutro "—") */}
      <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
          <span className="text-[11px] font-bold uppercase tracking-wider">Top Deporte Líder</span>
          <Layers size={18} className="p-0.5 rounded-md bg-purple-500/10" />
        </div>
        <div className="text-xl sm:text-2xl font-black mt-3 text-purple-800 dark:text-purple-300 truncate">
          {topCategory?.categoryName ?? '—'}
        </div>
        <div className="text-[12px] text-purple-700/80 dark:text-purple-400/80 mt-1 flex items-center justify-between">
          <span>{topCategory?.revenuePercentage ?? 0}% del volumen</span>
          <span className="font-bold text-[11px]">
            {formatMoney(topCategory?.totalRevenue ?? 0)}
          </span>
        </div>
      </div>
    </div>
  )
}
