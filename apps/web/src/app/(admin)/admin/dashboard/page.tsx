'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  AlertTriangle,
  Calendar,
  RefreshCw,
} from 'lucide-react'
import { formatMoney } from '@sportcomplex/core'
import { useApp } from '@/components/app-provider'
import { DashboardKPIs } from '@sportcomplex/features-admin'
import { DashboardCharts } from '@sportcomplex/features-admin'
import { DashboardTables } from '@sportcomplex/features-admin'

function getBogotaDateString(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d)
}

export interface AnalyticsSummary {
  totalAttendance: number
  totalTransactions: number
  totalRevenue: number
  uniqueAttendees: number
  totalBookings: number
  totalSpotsSold: number
}

export interface AttendanceMetric {
  date: string
  ticketsUsed: number
  uniqueUsers: number
}

export interface PeriodBreakdownItem {
  periodKey: string
  periodLabel: string
  attendance: number
  transactions: number
  revenue: number
}

export interface CategoryPerformanceMetric {
  categoryId: number
  categoryName: string
  categoryType: string
  totalBookings: number
  totalSpotsSold: number
  totalRevenue: number
  revenuePercentage: number
}

export interface ServicePerformanceMetric {
  serviceId: number
  serviceName: string
  modality: string
  totalSold: number
  totalUsed: number
  totalRevenue: number
}

export interface AnalyticsData {
  summary: AnalyticsSummary
  attendance: AttendanceMetric[]
  revenue: Array<{ date: string; paymentType: string; transactions: number; totalAmount: number }>
  periodBreakdown: {
    period: 'daily' | 'weekly'
    items: PeriodBreakdownItem[]
  }
  categoryPerformance: CategoryPerformanceMetric[]
  servicesComparison: ServicePerformanceMetric[]
  filters: {
    startDate?: string
    endDate?: string
    period: 'daily' | 'weekly'
    timezone: string
  }
}

export default function AdminDashboardPage() {
  const { notify } = useApp()
  const [period, setPeriod] = useState<'daily' | 'weekly'>('daily')
  const [quickRange, setQuickRange] = useState<'today' | '7d' | '30d' | 'custom'>('7d')
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return getBogotaDateString(d)
  })
  const [endDate, setEndDate] = useState<string>(() => getBogotaDateString())

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const handleRangeChange = (range: 'today' | '7d' | '30d') => {
    setQuickRange(range)
    const today = getBogotaDateString()
    setEndDate(today)

    if (range === 'today') {
      setStartDate(today)
    } else if (range === '7d') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      setStartDate(getBogotaDateString(d))
    } else if (range === '30d') {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      setStartDate(getBogotaDateString(d))
    }
  }

  const fetchAnalytics = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams({
        period,
        startDate,
        endDate,
      })
      const res = await fetch(`/api/admin/analytics?${params.toString()}`)
      const json = await res.json()

      if (res.ok && json.success && json.data) {
        setData(json.data)
      } else {
        throw new Error(json.error?.message ?? 'No se pudo sincronizar la analítica con el servidor.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al sincronizar analítica con el servidor.'
      setFetchError(msg)
      setData(null)
      notify(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportCsv = () => {
    if (!data || !data.servicesComparison || data.servicesComparison.length === 0) {
      notify('No hay datos analíticos disponibles para exportar.', 'error')
      return
    }

    const headers = [
      'Servicio / Escenario',
      'Modalidad',
      'Cupos Vendidos',
      'Cupos Usados (Puerta)',
      'Tasa Redencion (%)',
      'Recaudacion Total (COP)',
    ]

    const rows = data.servicesComparison.map((serv) => {
      const redemptionRate = serv.totalSold > 0 ? Math.round((serv.totalUsed / serv.totalSold) * 100) : 0
      return [
        `"${serv.serviceName.replace(/"/g, '""')}"`,
        `"${serv.modality}"`,
        serv.totalSold,
        serv.totalUsed,
        redemptionRate,
        serv.totalRevenue,
      ].join(',')
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `informe-operacion-${startDate}-a-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    notify('Informe CSV exportado y descargado exitosamente.', 'success')
  }

  useEffect(() => {
    fetchAnalytics()
  }, [period, startDate, endDate])

  const summary = data?.summary
  const breakdownItems = data?.periodBreakdown?.items ?? []
  const maxRevenue = useMemo(() => {
    return Math.max(...breakdownItems.map((b) => b.revenue), 1)
  }, [breakdownItems])
  const maxAttendance = useMemo(() => {
    return Math.max(...breakdownItems.map((b) => b.attendance), 1)
  }, [breakdownItems])

  return (
    <div className="admin-page-container space-y-6">
      {/* Top Header & Period Control */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-3 border-b border-[var(--line)]">
        <div>
          <div className="eyebrow text-[#557b53] dark:text-[#9ee285]">PANEL GERENCIAL (RF-21 / RNF-04)</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Analítica & Métricas de Operación
          </h1>
          <p className="text-xs sm:text-sm text-[var(--subtle)] mt-1">
            Recaudación Stripe, tasa de afluencia de torniquetes y comparativa de demanda por servicio en tiempo real.
          </p>
        </div>

        {/* Controles de Filtro */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Diario / Semanal */}
          <div className="flex items-center gap-1 bg-[var(--surface-soft)] p-1 rounded-xl border border-[var(--line)] text-xs">
            <button
              type="button"
              onClick={() => setPeriod('daily')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                period === 'daily'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--subtle)] hover:text-[var(--ink)]'
              }`}
            >
              Diario
            </button>
            <button
              type="button"
              onClick={() => setPeriod('weekly')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                period === 'weekly'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--subtle)] hover:text-[var(--ink)]'
              }`}
            >
              Semanal
            </button>
          </div>

          {/* Rangos Rápidos */}
          <div className="flex items-center gap-1 bg-[var(--surface-soft)] p-1 rounded-xl border border-[var(--line)] text-xs">
            <button
              type="button"
              onClick={() => handleRangeChange('today')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                quickRange === 'today' ? 'bg-[var(--surface)] text-[var(--ink)] font-bold shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('7d')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                quickRange === '7d' ? 'bg-[var(--surface)] text-[var(--ink)] font-bold shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              7 días
            </button>
            <button
              type="button"
              onClick={() => handleRangeChange('30d')}
              className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                quickRange === '30d' ? 'bg-[var(--surface)] text-[var(--ink)] font-bold shadow-xs' : 'text-[var(--subtle)]'
              }`}
            >
              30 días
            </button>
          </div>

          {/* Date inputs */}
          <div className="flex items-center gap-1.5 text-xs bg-[var(--surface)] px-2.5 py-1 rounded-xl border border-[var(--line)]">
            <Calendar size={13} className="text-[var(--subtle)]" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setQuickRange('custom')
                setStartDate(e.target.value)
              }}
              className="bg-transparent border-0 text-[var(--ink)] font-mono text-xs focus:outline-hidden"
            />
            <span className="text-[var(--subtle)]">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setQuickRange('custom')
                setEndDate(e.target.value)
              }}
              className="bg-transparent border-0 text-[var(--ink)] font-mono text-xs focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="p-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-soft)] text-[var(--ink)] transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error de Conexión / Servidor */}
      {fetchError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="shrink-0 text-red-600" />
            <div>
              <p className="font-bold">Error de sincronización analítica</p>
              <p className="text-[11px] opacity-90">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            disabled={isLoading}
            className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-xs"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Los 4 Indicadores Clave (KPIs Primarios) */}
      <DashboardKPIs
        summary={summary}
        categoryPerformance={data?.categoryPerformance}
        formatMoney={formatMoney}
      />

      {/* Gráficos de Alta Densidad */}
      <DashboardCharts
        period={period}
        breakdownItems={breakdownItems}
        maxAttendance={maxAttendance}
        maxRevenue={maxRevenue}
        totalAttendance={summary?.totalAttendance ?? 0}
        totalRevenue={summary?.totalRevenue ?? 0}
        formatMoney={formatMoney}
      />

      {/* Tablas Comparativas y Categorías */}
      <DashboardTables
        categoryPerformance={data?.categoryPerformance}
        servicesComparison={data?.servicesComparison}
        handleExportCsv={handleExportCsv}
        formatMoney={formatMoney}
      />
    </div>
  )
}

