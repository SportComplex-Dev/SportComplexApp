'use client'

import { useState, useId } from 'react'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  Layers,
  RefreshCw,
  Search,
  XCircle,
  Eye,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Ban,
} from 'lucide-react'
import { formatMoney } from '@sportcomplex/core'
import { Badge, Card, Modal } from '@sportcomplex/ui'
import { AdminBookingCancelModal } from './AdminBookingCancelModal'
import type {
  AdminBookingItem,
  AdminBookingMetrics,
  AdminBookingFiltersState,
  EstadoReservaAdmin,
} from './types'

export interface AdminBookingsViewProps {
  bookings: AdminBookingItem[]
  total: number
  metrics: AdminBookingMetrics
  filters: AdminBookingFiltersState
  isLoading?: boolean
  availableServices?: Array<{ id: number; name: string }>
  onFiltersChange: (newFilters: Partial<AdminBookingFiltersState>) => void
  onRefresh: () => void
  onCancelBooking?: (bookingId: string, motivo: string) => Promise<void>
}

export function formatSlotTime(dateInput: string | Date): string {
  try {
    if (!dateInput) return '00:00'

    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim()
      // Si viene serializado directamente como hora "HH:mm" o "HH:mm:ss"
      if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
        return trimmed.slice(0, 5)
      }
    }

    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return '00:00'
    return d.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Bogota',
    })
  } catch {
    return '00:00'
  }
}

export function formatDateString(dateInput: string | Date): string {
  try {
    if (!dateInput) return ''
    let d: Date
    if (typeof dateInput === 'string') {
      const clean = dateInput.trim()
      // Normalizar formato YYYY-MM-DD o ISO con medianoche UTC (e.g. 2026-10-16T00:00:00Z)
      // fijando la hora a mediodía para evitar desfase de 5 horas por UTC-5 (Bogotá)
      const dateMatch = clean.match(/^(\d{4}-\d{2}-\d{2})/)?.[1]
      if (dateMatch && (clean.length === 10 || clean.includes('T00:00:00'))) {
        d = new Date(`${dateMatch}T12:00:00`)
      } else {
        d = new Date(clean)
      }
    } else {
      d = dateInput
    }
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('es-CO', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Bogota',
    })
  } catch {
    return ''
  }
}

export function formatStatusBadge(status: EstadoReservaAdmin) {
  switch (status) {
    case 'CONFIRMADA':
      return (
        <Badge variant="success" className="text-[10px] font-bold">
          <CheckCircle2 size={11} className="mr-1" /> Confirmada
        </Badge>
      )
    case 'PENDIENTE_PAGO':
      return (
        <Badge variant="warning" className="text-[10px] font-bold">
          <Clock size={11} className="mr-1" /> Pendiente Pago
        </Badge>
      )
    case 'EXPIRADA':
      return (
        <Badge variant="secondary" className="text-[10px] font-bold">
          <Clock size={11} className="mr-1" /> Expirada
        </Badge>
      )
    case 'CANCELADA_ADMINISTRATIVA':
    case 'CANCELADA_PAGO':
    case 'CANCELADA':
      return (
        <Badge variant="destructive" className="text-[10px] font-bold">
          <XCircle size={11} className="mr-1" /> Cancelada
        </Badge>
      )
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export function AdminBookingsView({
  bookings = [],
  total = 0,
  metrics = { todayTotal: 0, confirmedCount: 0, pendingCount: 0, byService: [] },
  filters,
  isLoading = false,
  availableServices = [],
  onFiltersChange,
  onRefresh,
  onCancelBooking,
}: AdminBookingsViewProps) {
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [bookingToCancel, setBookingToCancel] = useState<AdminBookingItem | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const searchInputId = useId()
  const statusSelectId = useId()
  const serviceSelectId = useId()
  const dateFromId = useId()
  const dateToId = useId()

  const handleConfirmCancel = async (bookingId: string, motivo: string) => {
    if (!onCancelBooking) return
    setIsCancelling(true)
    try {
      await onCancelBooking(bookingId, motivo)
      setBookingToCancel(null)
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null)
      }
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(text)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const totalPages = Math.max(1, Math.ceil(total / filters.limit))
  const currentPage = filters.page

  // Calcular recaudación de reservas confirmadas mostradas
  const totalRevenue = bookings
    .filter((b) => b.estado === 'CONFIRMADA')
    .reduce((sum, b) => sum + (b.total || 0), 0)

  return (
    <div className="space-y-6">
      {/* 1. Header con Título y Control de Refresco */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-[var(--line)]">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-[#557b53] dark:text-[#9ee285] uppercase">
            OPERACIÓN GLOBAL (RF-21 / TSK-FE-27)
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)]">
            Gestión y Control de Reservas
          </h1>
          <p className="text-xs sm:text-sm text-[var(--subtle)] mt-1">
            Monitoreo en tiempo real de ocupación de pistas, aforo por franja y auditoría transaccional.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-soft)] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Sincronizando...' : 'Refrescar'}
        </button>
      </div>

      {/* 2. Tarjetas de KPIs Superiores (Utilizando Card de @sportcomplex/ui) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Reservas */}
        <Card className="p-4 border-[var(--line)] bg-[var(--surface)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[var(--subtle)]">
            <span>TOTAL REGISTRADAS</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CalendarDays size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-[var(--ink)]">
            {metrics.todayTotal || total}
          </div>
          <div className="mt-1 text-[11px] text-[var(--subtle)]">
            Histórico consultado: <b className="text-[var(--ink)]">{total}</b> reservas
          </div>
        </Card>

        {/* KPI 2: Confirmadas */}
        <Card className="p-4 border-[var(--line)] bg-[var(--surface)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[var(--subtle)]">
            <span>PAGADAS / CONFIRMADAS</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {metrics.confirmedCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--subtle)]">
            Tasa de efectividad:{' '}
            <b className="text-[var(--ink)]">
              {total > 0 ? Math.round((metrics.confirmedCount / total) * 100) : 0}%
            </b>
          </div>
        </Card>

        {/* KPI 3: Pendientes Stripe TTL */}
        <Card className="p-4 border-[var(--line)] bg-[var(--surface)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[var(--subtle)]">
            <span>EN CHECKOUT (TTL 15 MIN)</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {metrics.pendingCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--subtle)]">
            Bloqueo temporal pesimista activo
          </div>
        </Card>

        {/* KPI 4: Recaudación Visible */}
        <Card className="p-4 border-[var(--line)] bg-[var(--surface)] relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-[var(--subtle)]">
            <span>RECAUDACIÓN FILTRADA</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <DollarSign size={15} />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-400">
            {formatMoney(totalRevenue)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--subtle)]">
            Suma de confirmadas mostradas
          </div>
        </Card>
      </div>

      {/* 3. Grid de Ocupación por Servicio */}
      {metrics.byService && metrics.byService.length > 0 && (
        <div className="p-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--ink)] flex items-center gap-2">
                <Layers size={16} className="text-[#557b53]" /> Ocupación y Demanda por Servicio
              </h3>
              <p className="text-[11px] text-[var(--subtle)]">
                Distribución de cupos reservados según la base de datos
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">
              {metrics.byService.length} Servicios
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {metrics.byService.map((item) => {
              const maxCount = Math.max(...metrics.byService.map((s) => s.count), 1)
              const pct = Math.round((item.count / maxCount) * 100)

              return (
                <div
                  key={item.serviceId}
                  className="p-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)]/50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-[var(--ink)] truncate max-w-[150px]" title={item.serviceName}>
                      {item.serviceName}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {item.count} res.
                    </span>
                  </div>
                  <div className="w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#557b53] dark:bg-[#8cd766] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 4. Barra de Filtros Reactivos */}
      <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          {/* Búsqueda por texto */}
          <div className="lg:col-span-2">
            <label htmlFor={searchInputId} className="block text-[11px] font-bold text-[var(--subtle)] uppercase mb-1">
              Buscar Reserva
            </label>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]"
              />
              <input
                id={searchInputId}
                type="text"
                placeholder="Nombre, correo o ID de reserva..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ search: e.target.value, page: 1 })}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] outline-none focus:border-[#557b53]"
              />
            </div>
          </div>

          {/* Filtro por Estado */}
          <div>
            <label htmlFor={statusSelectId} className="block text-[11px] font-bold text-[var(--subtle)] uppercase mb-1">
              Estado
            </label>
            <select
              id={statusSelectId}
              value={filters.status}
              onChange={(e) => onFiltersChange({ status: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] outline-none focus:border-[#557b53]"
            >
              <option value="">Todos los estados</option>
              <option value="CONFIRMADA">Confirmada</option>
              <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
              <option value="EXPIRADA">Expirada</option>
              <option value="CANCELADA_ADMINISTRATIVA">Cancelada Administrativa</option>
              <option value="CANCELADA_PAGO">Cancelada por Pago</option>
            </select>
          </div>

          {/* Filtro por Servicio */}
          <div>
            <label htmlFor={serviceSelectId} className="block text-[11px] font-bold text-[var(--subtle)] uppercase mb-1">
              Servicio / Cancha
            </label>
            <select
              id={serviceSelectId}
              value={filters.serviceId}
              onChange={(e) => onFiltersChange({ serviceId: e.target.value, page: 1 })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] outline-none focus:border-[#557b53]"
            >
              <option value="">Todos los servicios</option>
              {availableServices.map((srv) => (
                <option key={srv.id} value={srv.id.toString()}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fechas */}
          <div className="flex gap-2">
            <div className="w-1/2">
              <label htmlFor={dateFromId} className="block text-[11px] font-bold text-[var(--subtle)] uppercase mb-1">
                Desde
              </label>
              <input
                id={dateFromId}
                type="date"
                value={filters.dateFrom}
                onChange={(e) => onFiltersChange({ dateFrom: e.target.value, page: 1 })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] outline-none focus:border-[#557b53]"
              />
            </div>
            <div className="w-1/2">
              <label htmlFor={dateToId} className="block text-[11px] font-bold text-[var(--subtle)] uppercase mb-1">
                Hasta
              </label>
              <input
                id={dateToId}
                type="date"
                value={filters.dateTo}
                onChange={(e) => onFiltersChange({ dateTo: e.target.value, page: 1 })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[var(--ink)] outline-none focus:border-[#557b53]"
              />
            </div>
          </div>
        </div>

        {/* Resumen de filtros activos */}
        {(filters.search || filters.status || filters.serviceId || filters.dateFrom || filters.dateTo) && (
          <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[var(--subtle)]">
              <Filter size={12} /> Filtros activos aplicados
            </div>
            <button
              type="button"
              onClick={() =>
                onFiltersChange({
                  search: '',
                  status: '',
                  serviceId: '',
                  dateFrom: '',
                  dateTo: '',
                  page: 1,
                })
              }
              className="text-[#557b53] dark:text-[#9ee285] hover:underline font-semibold cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        )}
      </div>

      {/* 5. Tabla Reactiva de Alta Densidad (Full-Bleed con aire visual pl-6 / pr-6) */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-[var(--ink)]">Listado Oficial de Reservas</h3>
            <p className="text-[11px] text-[var(--subtle)]">
              Mostrando {bookings.length} de {total} registros encontrados
            </p>
          </div>
          <span className="text-xs text-[var(--subtle)]">
            Página <b>{currentPage}</b> de <b>{totalPages}</b>
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full min-w-[700px] text-left text-xs sm:text-sm table-auto">
            <thead className="bg-[var(--surface-soft)] text-[var(--subtle)] font-bold uppercase text-[10px] tracking-wider border-b border-[var(--line)]">
              <tr>
                <th className="py-3 pl-6 pr-3 w-[15%]">Código / ID</th>
                <th className="py-3 px-3 w-[22%]">Cliente</th>
                <th className="py-3 px-3 w-[22%]">Servicio / Recinto</th>
                <th className="py-3 px-3 w-[16%]">Fecha y Franja</th>
                <th className="py-3 px-3 text-right w-[11%]">Total</th>
                <th className="py-3 px-3 text-center w-[10%]">Estado</th>
                <th className="py-3 pl-3 pr-6 text-right w-[4%]">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {isLoading ? (
                // Skeletons de carga
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 pl-6 pr-3">
                      <div className="h-4 bg-[var(--line)] rounded w-20" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 bg-[var(--line)] rounded w-32 mb-1" />
                      <div className="h-3 bg-[var(--line)] rounded w-24" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 bg-[var(--line)] rounded w-28 mb-1" />
                      <div className="h-3 bg-[var(--line)] rounded w-16" />
                    </td>
                    <td className="py-3 px-3">
                      <div className="h-4 bg-[var(--line)] rounded w-24" />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="h-4 bg-[var(--line)] rounded w-16 ml-auto" />
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="h-4 bg-[var(--line)] rounded w-20 mx-auto" />
                    </td>
                    <td className="py-3 pl-3 pr-6 text-right">
                      <div className="h-6 w-6 bg-[var(--line)] rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[var(--subtle)]">
                    <Sparkles size={28} className="mx-auto mb-2 text-[#557b53] opacity-50" />
                    <p className="font-bold text-sm text-[var(--ink)]">No se encontraron reservas</p>
                    <p className="text-xs mt-1">
                      Intenta ajustar los filtros de búsqueda o el rango de fechas.
                    </p>
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const s = b.disponibilidad?.servicio
                  const f = b.disponibilidad?.franja
                  const fechaStr = formatDateString(b.disponibilidad?.fecha)
                  const horaInicio = f ? formatSlotTime(f.horaInicio) : '00:00'
                  const horaFin = f ? formatSlotTime(f.horaFin) : '00:00'

                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-[var(--surface-soft)]/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedBooking(b)}
                    >
                      {/* Código / ID */}
                      <td className="py-3 pl-6 pr-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] font-mono text-[var(--subtle)] bg-[var(--surface-soft)] px-1.5 py-0.5 rounded border border-[var(--line)]">
                            {b.id.slice(0, 8)}
                          </code>
                          <button
                            type="button"
                            title="Copiar ID de reserva"
                            onClick={() => handleCopy(b.id)}
                            className="p-1 text-[var(--subtle)] hover:text-[var(--ink)] rounded cursor-pointer"
                          >
                            {copiedId === b.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-xs text-[var(--ink)]">
                          {b.titular?.nombre || 'Cliente General'}
                        </div>
                        <div className="text-[11px] text-[var(--subtle)] truncate max-w-[180px]">
                          {b.titular?.correo || 'Sin correo registrado'}
                        </div>
                      </td>

                      {/* Servicio y Canal */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-xs text-[var(--ink)]">
                          {s?.nombre || 'Servicio Desconocido'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-[var(--subtle)]">
                            {s?.categoria?.nombre || 'General'}
                          </span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--surface-soft)] border border-[var(--line)] text-[var(--subtle)] uppercase">
                            {b.canal}
                          </span>
                        </div>
                      </td>

                      {/* Fecha y Franja */}
                      <td className="py-3 px-3">
                        <div className="text-xs font-semibold text-[var(--ink)]">{fechaStr}</div>
                        <div className="text-[11px] text-[#557b53] dark:text-[#9ee285] font-mono">
                          {horaInicio} - {horaFin}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3 px-3 text-right font-black text-xs text-emerald-700 dark:text-emerald-400">
                        {formatMoney(b.total)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center">
                        {formatStatusBadge(b.estado)}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 pl-3 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] hover:bg-[var(--line)] text-[var(--ink)] transition-colors cursor-pointer"
                            title="Ver detalle de la reserva"
                          >
                            <Eye size={13} />
                          </button>
                          {(b.estado === 'CONFIRMADA' || b.estado === 'PENDIENTE_PAGO') && onCancelBooking && (
                            <button
                              type="button"
                              onClick={() => setBookingToCancel(b)}
                              className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              title="Cancelar reserva administrativamente"
                            >
                              <Ban size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Paginación Inferior */}
        <div className="px-6 py-3 border-t border-[var(--line)] flex items-center justify-between text-xs bg-[var(--surface-soft)]/30">
          <span className="text-[var(--subtle)]">
            Total reservas filtradas: <b>{total}</b>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => onFiltersChange({ page: currentPage - 1 })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-soft)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft size={13} /> Anterior
            </button>
            <span className="font-semibold text-[var(--ink)]">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => onFiltersChange({ page: currentPage + 1 })}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-soft)] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Siguiente <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Modal de Detalle de Reserva */}
      {selectedBooking && (
        <Modal
          onClose={() => setSelectedBooking(null)}
          title="Detalle Transaccional de la Reserva"
          maxWidth="540px"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[var(--surface-soft)] border border-[var(--line)] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block">
                  Identificador UUID
                </span>
                <code className="text-xs font-mono font-bold text-[var(--ink)] select-all">
                  {selectedBooking.id}
                </code>
              </div>
              <div>{formatStatusBadge(selectedBooking.estado)}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block">Titular</span>
                <div className="font-bold text-sm text-[var(--ink)]">{selectedBooking.titular?.nombre}</div>
                <div className="text-[var(--subtle)]">{selectedBooking.titular?.correo}</div>
              </div>

              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block">Recinto / Servicio</span>
                <div className="font-bold text-sm text-[var(--ink)]">
                  {selectedBooking.disponibilidad?.servicio?.nombre}
                </div>
                <div className="text-[var(--subtle)]">
                  Tarifa base: {formatMoney(selectedBooking.disponibilidad?.servicio?.tarifa || 0)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--line)]">
              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block">Fecha & Horario</span>
                <div className="font-semibold text-[var(--ink)]">
                  {formatDateString(selectedBooking.disponibilidad?.fecha)}
                </div>
                <div className="font-mono text-[#557b53] dark:text-[#9ee285]">
                  {formatSlotTime(selectedBooking.disponibilidad?.franja?.horaInicio)} -{' '}
                  {formatSlotTime(selectedBooking.disponibilidad?.franja?.horaFin)}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block">Canal y Cupos</span>
                <div className="font-semibold text-[var(--ink)]">
                  Canal: <b className="uppercase">{selectedBooking.canal}</b>
                </div>
                <div className="text-[var(--subtle)]">
                  Cupos reservados: <b>{selectedBooking.cantidadCupos}</b>
                </div>
              </div>
            </div>

            {(selectedBooking.estado === 'CONFIRMADA' || selectedBooking.estado === 'PENDIENTE_PAGO') && onCancelBooking && (
              <div className="pt-2 border-t border-[var(--line)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setBookingToCancel(selectedBooking)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
                >
                  <Ban size={13} /> Anular Reserva Administrativamente
                </button>
              </div>
            )}

            {/* Liquidación Monetaria */}
            <div className="pt-2 border-t border-[var(--line)]">
              <div className="flex justify-between py-1">
                <span className="text-[var(--subtle)]">Subtotal</span>
                <span className="font-semibold text-[var(--ink)]">{formatMoney(selectedBooking.subtotal)}</span>
              </div>
              {selectedBooking.descuentoPct > 0 && (
                <div className="flex justify-between py-1 text-emerald-600">
                  <span>Descuento aplicado</span>
                  <span>-{selectedBooking.descuentoPct}%</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 text-sm font-black border-t border-[var(--line)]">
                <span className="text-[var(--ink)]">Total Cobrado</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  {formatMoney(selectedBooking.total)}
                </span>
              </div>
            </div>

            {/* Tickets QR Asociados si existen */}
            {selectedBooking.tickets && selectedBooking.tickets.length > 0 && (
              <div className="pt-2 border-t border-[var(--line)]">
                <span className="text-[10px] text-[var(--subtle)] uppercase font-bold block mb-2">
                  Tiquetes de Acceso Emitidos ({selectedBooking.tickets.length})
                </span>
                <div className="space-y-1.5">
                  {selectedBooking.tickets.map((t) => (
                    <div
                      key={t.id}
                      className="p-2 rounded bg-[var(--surface-soft)] flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono font-bold text-[var(--ink)]">{t.codigo}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {t.estado}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 8. Modal de Cancelación Administrativa (TSK-FE-28) */}
      <AdminBookingCancelModal
        booking={bookingToCancel}
        isOpen={Boolean(bookingToCancel)}
        onClose={() => setBookingToCancel(null)}
        onConfirm={handleConfirmCancel}
        isLoading={isCancelling}
      />
    </div>
  )
}
