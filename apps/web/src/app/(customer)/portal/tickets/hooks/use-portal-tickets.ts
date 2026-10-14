'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  fetchReceiptData,
  generarQRDataUrl,
  sanitizeFilename,
  type PortalTicket,
  type ReceiptApiResponse,
} from '@/components/portal/portal-utils'
import type { ToastKind } from '@/components/toast-message'
import type { TabType, UserTournamentItem } from '../types'

export function usePortalTickets(
  sessionName: string | undefined,
  notify: (msg: string, type?: ToastKind) => void
) {
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null)
  const [printingTicket, setPrintingTicket] = useState<PortalTicket | null>(null)
  const [printingReceipt, setPrintingReceipt] = useState<ReceiptApiResponse | null>(null)
  const [printingQrUrl, setPrintingQrUrl] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isPrinting, setIsPrinting] = useState<boolean>(false)
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
          setSelectedTicket((prev) =>
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

  const handlePrintTicket = useCallback(async (ticket: PortalTicket) => {
    try {
      setIsPrinting(true)
      const receipt = await fetchReceiptData(ticket.id).catch(() => null)
      const qrTarget = receipt?.qr?.payload || ticket.qrPayload || ticket.code
      const qrUrl = receipt?.qr?.dataUrl || (await generarQRDataUrl(qrTarget, 260))
      setPrintingQrUrl(qrUrl)
      setPrintingReceipt(receipt)
      setPrintingTicket(ticket)

      let styleTag = document.getElementById('thermal-print-page-style')
      if (!styleTag) {
        styleTag = document.createElement('style')
        styleTag.id = 'thermal-print-page-style'
        styleTag.innerHTML = '@page { size: 58mm auto; margin: 0; }'
        document.head.appendChild(styleTag)
      }

      document.body.classList.add('printing-thermal-receipt')

      let cleanedUp = false
      const cleanupPrintStyles = () => {
        if (cleanedUp) return
        cleanedUp = true
        document.body.classList.remove('printing-thermal-receipt')
        document.getElementById('thermal-print-page-style')?.remove()
        setPrintingTicket(null)
        setPrintingQrUrl(null)
        setPrintingReceipt(null)
        setIsPrinting(false)
        window.removeEventListener('afterprint', handleAfterPrint)
      }

      const handleAfterPrint = () => {
        cleanupPrintStyles()
      }
      window.addEventListener('afterprint', handleAfterPrint)

      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print()
          setTimeout(cleanupPrintStyles, 2500)
        }, 300)
      })
    } catch (err) {
      console.error('Error al preparar impresión:', err)
      document.body.classList.remove('printing-thermal-receipt')
      document.getElementById('thermal-print-page-style')?.remove()
      setPrintingTicket(null)
      setPrintingQrUrl(null)
      setPrintingReceipt(null)
      setIsPrinting(false)
      notify('Error al preparar el comprobante para impresión.', 'error')
    }
  }, [notify])

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
    printingTicket,
    printingReceipt,
    printingQrUrl,
    downloadingId,
    isPrinting,
    handleOpenQrModal,
    handlePrintTicket,
    handleDownloadQr,
  }
}
