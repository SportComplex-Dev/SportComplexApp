'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  obtenerProximaReserva,
  type PortalTicket,
} from '../utils/portal-utils'

export type CustomerPortalTabType = 'activas' | 'historial' | 'canceladas'

export function useCustomerPortal(sessionName?: string, todayDate?: string) {
  const [activeTab, setActiveTab] = useState<CustomerPortalTabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null)
  const [dbBookings, setDbBookings] = useState<PortalTicket[]>([])

  useEffect(() => {
    let isMounted = true
    fetchCustomerBookingHistory(sessionName ?? 'Cliente')
      .then((items) => {
        if (isMounted && items.length > 0) {
          setDbBookings(items)
        }
      })
      .catch(() => {
        // Fallback silencioso
      })

    return () => {
      isMounted = false
    }
  }, [sessionName])

  const next = useMemo(() => {
    return obtenerProximaReserva(dbBookings, todayDate)
  }, [dbBookings, todayDate])

  const { activas: activeBookings, historial: historyBookings, canceladas: cancelledBookings } =
    useMemo(() => clasificarReservas(dbBookings), [dbBookings])

  const currentTabItems = useMemo(() => {
    switch (activeTab) {
      case 'activas':
        return activeBookings
      case 'historial':
        return historyBookings
      case 'canceladas':
        return cancelledBookings
    }
  }, [activeTab, activeBookings, historyBookings, cancelledBookings])

  return {
    activeTab,
    setActiveTab,
    next,
    activeBookings,
    historyBookings,
    cancelledBookings,
    currentTabItems,
    selectedTicket,
    setSelectedTicket,
  }
}
