'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  generarQRDataUrl,
  obtenerProximaReserva,
  type PortalTicket,
} from '@/components/portal/portal-utils'
import type { Booking } from '@sportcomplex/core'

export type TabType = 'activas' | 'historial' | 'canceladas'

export function useCustomerPortal(sessionName?: string, todayDate?: string) {
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null)
  const [printingTicket, setPrintingTicket] = useState<Booking | null>(null)
  const [printingQrUrl, setPrintingQrUrl] = useState<string | null>(null)
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

  const handlePrintTicket = useCallback(async (ticket: Booking) => {
    try {
      const qrUrl = await generarQRDataUrl(ticket.code, 260)
      setPrintingQrUrl(qrUrl)
    } catch {
      setPrintingQrUrl(null)
    }
    setPrintingTicket(ticket)
    setTimeout(() => {
      window.print()
    }, 200)
  }, [])

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
    printingTicket,
    printingQrUrl,
    handlePrintTicket,
  }
}
