'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import {
  AdminBookingsView,
  type AdminBookingItem,
  type AdminBookingMetrics,
  type AdminBookingFiltersState,
} from '@sportcomplex/features-admin'
import { useApp } from '@/components/layout/app-provider'

export default function AdminBookingsPage() {
  const { notify } = useApp()
  const [, startTransition] = useTransition()
  const [bookings, setBookings] = useState<AdminBookingItem[]>([])
  const [total, setTotal] = useState(0)
  const [metrics, setMetrics] = useState<AdminBookingMetrics>({
    todayTotal: 0,
    confirmedCount: 0,
    pendingCount: 0,
    byService: [],
  })
  const [availableServices, setAvailableServices] = useState<Array<{ id: number; name: string }>>([])
  const [isLoading, setIsLoading] = useState(true)

  const [filters, setFilters] = useState<AdminBookingFiltersState>({
    search: '',
    status: '',
    serviceId: '',
    dateFrom: '',
    dateTo: '',
    page: 1,
    limit: 15,
  })

  // Cargar lista de servicios disponibles para el filtro desde el endpoint administrativo oficial
  useEffect(() => {
    fetch('/api/admin/services?entity=services')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setAvailableServices(
            json.data.map((s: { id: number; name?: string; nombre?: string }) => ({
              id: s.id,
              name: s.nombre || s.name || `Servicio #${s.id}`,
            }))
          )
        }
      })
      .catch(() => {})
  }, [])

  const fetchBookings = useCallback(async (currentFilters: AdminBookingFiltersState) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', currentFilters.limit.toString())
      params.set('offset', ((currentFilters.page - 1) * currentFilters.limit).toString())

      if (currentFilters.status) params.set('status', currentFilters.status)
      if (currentFilters.serviceId) params.set('serviceId', currentFilters.serviceId)
      if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom)
      if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo)
      if (currentFilters.search.trim()) params.set('search', currentFilters.search.trim())

      const res = await fetch(`/api/admin/bookings?${params.toString()}`)
      const json = await res.json()

      if (res.ok && json.success && json.data) {
        setBookings(json.data.items || [])
        setTotal(json.data.total || 0)
        if (json.data.metrics) {
          setMetrics(json.data.metrics)
        }
      } else {
        throw new Error(json.error?.message || 'Error al obtener las reservas.')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con el servidor.'
      notify(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  const prevSearchRef = useRef(filters.search)

  // Carga inicial y cuando cambian los filtros:
  // Debounce de 300 ms únicamente si cambió el texto de búsqueda. Paginación y selects responden de inmediato.
  useEffect(() => {
    const isSearchChange = prevSearchRef.current !== filters.search
    prevSearchRef.current = filters.search

    if (isSearchChange) {
      const timer = setTimeout(() => {
        startTransition(() => {
          fetchBookings(filters)
        })
      }, 300)

      return () => clearTimeout(timer)
    }

    startTransition(() => {
      fetchBookings(filters)
    })
  }, [filters, fetchBookings])

  const handleFiltersChange = (newFilters: Partial<AdminBookingFiltersState>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }))
  }

  return (
    <div className="admin-page-container">
      <AdminBookingsView
        bookings={bookings}
        total={total}
        metrics={metrics}
        filters={filters}
        isLoading={isLoading}
        availableServices={availableServices}
        onFiltersChange={handleFiltersChange}
        onRefresh={() => fetchBookings(filters)}
      />
    </div>
  )
}
