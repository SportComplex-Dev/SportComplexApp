'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  fetchReceiptData,
  generarQRDataUrl,
  sanitizeFilename,
  type PortalTicket,
} from '../utils/portal-utils'
import type { TabType, UserTournamentItem, ToastKind } from '../types/portal'

export function usePortalTickets(
  sessionName: string | undefined,
  notify: (msg: string, type?: ToastKind) => void
) {
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [dbBookings, setDbBookings] = useState<PortalTicket[]>([])
  const [userTournaments, setUserTournaments] = useState<UserTournamentItem[]>([])

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

    fetch('/api/tournaments')
      .then((res) => res.json())
      .then((json) => {
        if (!isMounted || !json.success || !Array.isArray(json.data)) return
        const registered = json.data.filter((t: { yaInscrito?: boolean }) => t.yaInscrito)
        if (isMounted) {
          setUserTournaments(registered)
        }
      })
      .catch((err) => {
        console.error('Error cargando torneos del usuario:', err)
      })

    return () => {
      isMounted = false
    }
  }, [sessionName])

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
      case 'torneos':
        return []
    }
  }, [activeTab, activeBookings, historyBookings, cancelledBookings])

  const handleOpenQrModal = useCallback(async (ticket: PortalTicket) => {
    setSelectedTicket(ticket)
    if (!ticket.qrPayload && ticket.id) {
      try {
        const receipt = await fetchReceiptData(ticket.id)
        const qr = receipt?.qr
        if (qr?.payload) {
          setSelectedTicket((prev: PortalTicket | null) =>
            prev && prev.id === ticket.id
              ? { ...prev, qrPayload: qr.payload, qrDataUrl: qr.dataUrl }
              : prev
          )
        }
      } catch {
        // Fallback manteniendo ticket
      }
    }
  }, [])

  const handleDownloadQr = useCallback(async (ticket: PortalTicket) => {
    if (downloadingId) return
    setDownloadingId(ticket.id)
    try {
      let dataUrl = ticket.qrDataUrl
      let qrPayload = ticket.qrPayload

      if (!dataUrl) {
        const receipt = await fetchReceiptData(ticket.id).catch(() => null)
        if (receipt?.qr?.dataUrl) {
          dataUrl = receipt.qr.dataUrl
        } else {
          qrPayload = receipt?.qr?.payload || ticket.qrPayload || ticket.code
          dataUrl = await generarQRDataUrl(qrPayload, 600)
        }
      }

      const safeFilename = `ticket-${sanitizeFilename(ticket.code)}.png`
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = safeFilename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      notify('Imagen QR descargada correctamente.', 'success')
    } catch (err) {
      console.error('Error al descargar QR:', err)
      notify('No se pudo descargar el código QR.', 'error')
    } finally {
      setDownloadingId(null)
    }
  }, [downloadingId, notify])

  return {
    activeTab,
    setActiveTab,
    activeBookings,
    historyBookings,
    cancelledBookings,
    userTournaments,
    currentTabItems,
    selectedTicket,
    setSelectedTicket,
    downloadingId,
    handleOpenQrModal,
    handleDownloadQr,
  }
}
