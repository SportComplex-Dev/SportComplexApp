'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  DollarSign,
  Download,
  Layers,
  RefreshCw,
  Ticket,
  TrendingUp,
  UserCheck,
} from 'lucide-react'
import { formatMoney } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { useApp } from '@/components/app-provider'

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

        {/* KPI 4: Rendimiento de Categorías */}
        <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Top Deporte Líder</span>
            <Layers size={18} className="p-0.5 rounded-md bg-purple-500/10" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-3 text-purple-800 dark:text-purple-300 truncate">
            {data?.categoryPerformance[0]?.categoryName ?? 'Canchas'}
          </div>
          <div className="text-[12px] text-purple-700/80 dark:text-purple-400/80 mt-1 flex items-center justify-between">
            <span>{data?.categoryPerformance[0]?.revenuePercentage ?? 0}% del volumen</span>
            <span className="font-bold text-[11px]">
              {formatMoney(data?.categoryPerformance[0]?.totalRevenue ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Gráficos de Alta Densidad */}
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
            <span>Total: {summary?.totalAttendance ?? 0} validados</span>
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
              {formatMoney(summary?.totalRevenue ?? 0)}
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
            <span>Total ingresos: {formatMoney(summary?.totalRevenue ?? 0)}</span>
          </div>
        </div>
      </div>

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
            {data?.categoryPerformance.length ?? 0} Categorías
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.categoryPerformance ?? []).map((cat) => (
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
              {(data?.servicesComparison ?? []).map((serv) => {
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
