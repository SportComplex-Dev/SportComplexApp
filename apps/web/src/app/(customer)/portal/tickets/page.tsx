'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Printer,
  QrCode,
  ShieldCheck,
  Ticket,
  Trophy,
  X,
} from 'lucide-react'
import {
  formatDate,
  formatMoney,
} from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { useBookings, useLastCode } from '@/lib/stores'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  fetchReceiptData,
  generarQRDataUrl,
  sanitizeFilename,
  type ReceiptApiResponse,
} from '@/components/portal/portal-utils'
import { QRGraphicHD } from '@/components/portal/qr-modal'
import { PrintableReceipt } from '@/components/portal/printable-receipt'
import { AccessWindowIndicator } from '@/components/portal/access-window-indicator'
import type { PortalTicket } from '@/components/portal/portal-utils'

type TabType = 'activas' | 'historial' | 'canceladas' | 'torneos'

interface UserTournamentItem {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { id: number; nombre: string }
  fechaInicio: string
  fechaFin: string
  precioInscripcion: number | string
  miInscripcion?: {
    id: string
    estado: string
    nombrePareja?: string | null
    ticketCodigoUuid?: string | null
    ticketQrPayload?: string | null
    ticket?: { id?: string; codigo?: string; codigoUuid?: string; qrPayload?: string }
  }
}

export default function TicketsPage() {
  const { session, notify } = useApp()
  const [localBookings] = useBookings()
  const [, setLastCode] = useLastCode()
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<PortalTicket | null>(null)
  const [printingTicket, setPrintingTicket] = useState<PortalTicket | null>(null)
  const [printingReceipt, setPrintingReceipt] = useState<ReceiptApiResponse | null>(null)
  const [printingQrUrl, setPrintingQrUrl] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [isPrinting, setIsPrinting] = useState<boolean>(false)
  const [dbBookings, setDbBookings] = useState<PortalTicket[]>([])
  const [userTournaments, setUserTournaments] = useState<UserTournamentItem[]>([])

  // Cargar historial real desde el endpoint TSK-BE-13
  useEffect(() => {
    let isMounted = true
    fetchCustomerBookingHistory(session?.name ?? 'Cliente')
      .then((items) => {
        if (isMounted && items.length > 0) {
          setDbBookings(items)
        }
      })
      .catch(() => {
        // Fallback a almacenamiento local
      })

    // PERF-01: Cargar torneos en los que el usuario se ha inscrito directamente sin cascada N+1
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
  }, [session])

  const allBookings = useMemo<PortalTicket[]>(() => {
    const combined: PortalTicket[] = [...dbBookings]
    const dbCodes = new Set(dbBookings.map((b) => b.code))
    localBookings.forEach((b) => {
      if (!dbCodes.has(b.code)) {
        combined.push(b)
      }
    })
    return combined
  }, [dbBookings, localBookings])

  const { activas: activeBookings, historial: historyBookings, canceladas: cancelledBookings } =
    useMemo(() => clasificarReservas(allBookings), [allBookings])

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

      // Inyectar regla @page 58mm temporalmente para esta impresión (CSS-01)
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

      // Doble ciclo para renderizado seguro en DOM y rescate si no emite afterprint (NEW-01 & RACE-01)
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

  return (
    <>
      <main className="section-shell app-page no-print">
        <Link href="/portal" className="calendar-shortcut mb-6 inline-flex text-xs py-2 px-3 gap-1.5">
          <ArrowLeft size={14} /> Volver a Mi Portal
        </Link>

        <PageHeading
          eyebrow="BILLETERA DIGITAL (RF-10 / RF-12)"
          title="Mis Tiquetes y Pases de Acceso"
          description="Consulta tus pases deportivos vigentes con código QR para torniquetes o descarga tu comprobante en formato PDF."
        />

        <section className="mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="portal-tabs-nav">
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'activas' ? 'active' : ''}`}
                onClick={() => setActiveTab('activas')}
              >
                Pases Activos
                <span className="portal-tab-badge">{activeBookings.length}</span>
              </button>
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
                onClick={() => setActiveTab('historial')}
              >
                Historial
                <span className="portal-tab-badge">{historyBookings.length}</span>
              </button>
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'canceladas' ? 'active' : ''}`}
                onClick={() => setActiveTab('canceladas')}
              >
                Cancelados
                <span className="portal-tab-badge">{cancelledBookings.length}</span>
              </button>
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'torneos' ? 'active' : ''}`}
                onClick={() => setActiveTab('torneos')}
              >
                <Trophy size={13} className="text-amber-500 inline-block mr-1" />
                Torneos
                <span className="portal-tab-badge">{userTournaments.length}</span>
              </button>
            </div>

            <Link href="/services" className="calendar-shortcut text-xs py-2.5 px-3.5 gap-2 w-full md:w-auto justify-center">
              <Ticket size={14} /> Reservar nuevo espacio <ArrowRight size={13} />
            </Link>
          </div>

          {activeTab === 'torneos' ? (
            userTournaments.length === 0 ? (
              <div className="demo-card text-center py-12">
                <Trophy size={36} className="mx-auto text-[var(--subtle)] mb-3 opacity-60" />
                <b className="block text-base">No tienes inscripciones a torneos activas</b>
                <p className="text-sm text-[var(--subtle)] mt-1 mb-5">
                  Inscríbete en nuestros torneos competitivos y eventos deportivos desde la página de inicio o el catálogo.
                </p>
                <Link href="/" className="action-button text-xs py-2 px-4">
                  Ver Torneos Disponibles <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <div className="grid gap-3">
                {userTournaments.map((tournament) => {
                  const ins = tournament.miInscripcion
                  const estadoIns = ins?.estado ?? 'CONFIRMADA'
                  const isConfirmed = estadoIns === 'CONFIRMADA'
                  // INT-01: Usar identificador real del ticket firmado ticketCodigoUuid
                  const ticketCode = ins?.ticketCodigoUuid || ins?.ticket?.codigo || ins?.ticket?.codigoUuid || (isConfirmed ? `TRN-${tournament.id.slice(0, 8)}` : 'PENDIENTE')
                  const precioNum = Number(tournament.precioInscripcion ?? 0)

                  const handleOpenTournamentQR = () => {
                    const fakeBooking: Booking = {
                      id: tournament.id,
                      code: ticketCode,
                      service: `Torneo: ${tournament.titulo}`,
                      category: tournament.categoria?.nombre || 'Torneo',
                      sede: 'Sede Principal',
                      date: tournament.fechaInicio.split('T')[0],
                      time: new Date(tournament.fechaInicio).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      attendees: ins?.nombrePareja ? 2 : 1,
                      amount: precioNum,
                      status: isConfirmed ? 'Confirmada' : 'Pendiente',
                      client: session?.name || 'Socio',
                    }
                    setSelectedTicket(fakeBooking)
                  }

                  const handlePrintTournamentTicket = () => {
                    const fakeBooking: Booking = {
                      id: tournament.id,
                      code: ticketCode,
                      service: `Torneo: ${tournament.titulo}`,
                      category: tournament.categoria?.nombre || 'Torneo',
                      sede: 'Sede Principal',
                      date: tournament.fechaInicio.split('T')[0],
                      time: new Date(tournament.fechaInicio).toLocaleTimeString('es-CO', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                      attendees: ins?.nombrePareja ? 2 : 1,
                      amount: precioNum,
                      status: isConfirmed ? 'Confirmada' : 'Pendiente',
                      client: session?.name || 'Socio',
                    }
                    handlePrintTicket(fakeBooking)
                  }

                  return (
                    <div key={tournament.id} className="portal-ticket-item">
                      <div className="portal-ticket-info">
                        <div className="flex items-center gap-2.5">
                          <b className="text-base tracking-tight">{tournament.titulo}</b>
                          <Badge
                            variant={isConfirmed ? 'success' : 'secondary'}
                            className="text-[11px] px-2 py-0.5 shrink-0"
                          >
                            {isConfirmed ? 'Confirmada' : 'Pendiente Pago'}
                          </Badge>
                        </div>
                        <span className="text-xs text-[var(--subtle)] flex flex-wrap items-center gap-2 mt-1">
                          <span>
                            <strong className="text-[var(--ink)] font-semibold">{ticketCode}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            {new Date(tournament.fechaInicio).toLocaleDateString('es-CO', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span>·</span>
                          <span>Nivel: {tournament.nivel}</span>
                          {ins?.nombrePareja && (
                            <>
                              <span>·</span>
                              <span>Pareja: <strong>{ins.nombrePareja}</strong></span>
                            </>
                          )}
                          <span>·</span>
                          <span>
                            {precioNum === 0 ? 'Gratuito' : `${formatMoney(precioNum)} COP`}
                          </span>
                        </span>
                      </div>

                      {/* BUS-01: Condicionar QR de acceso y PDF estrictamente a inscripciones confirmadas */}
                      <div className="portal-ticket-actions">
                        {isConfirmed ? (
                          <>
                            <button
                              type="button"
                              onClick={handleOpenTournamentQR}
                              className="action-button text-xs py-2 px-3.5 gap-2"
                            >
                              <QrCode size={15} /> Ver QR de Acceso
                            </button>
                            <button
                              type="button"
                              onClick={handlePrintTournamentTicket}
                              className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                              title="Descargar comprobante en PDF"
                            >
                              <Download size={14} /> PDF
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              Pago pendiente en taquilla
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : currentTabItems.length === 0 ? (
            <div className="demo-card text-center py-12">
              <Ticket size={36} className="mx-auto text-[var(--subtle)] mb-3 opacity-60" />
              <b className="block text-base">No hay pases registrados</b>
              <p className="text-sm text-[var(--subtle)] mt-1 mb-5">
                {activeTab === 'activas'
                  ? 'No cuentas con pases activos en este momento.'
                  : activeTab === 'historial'
                  ? 'No hay registros en tu historial de compras pasadas.'
                  : 'No tienes reservas canceladas.'}
              </p>
              <Link href="/services" className="action-button text-xs py-2 px-4">
                Explorar catálogo deportivo <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {currentTabItems.map((booking) => {
                const isConfirmed = booking.status === 'Confirmada'
                return (
                  <div key={booking.id} className="portal-ticket-item">
                    <div className="portal-ticket-info">
                      <div className="flex items-center gap-2.5">
                        <b className="text-base tracking-tight">{booking.service}</b>
                        <Badge
                          variant={
                            booking.status === 'Confirmada'
                              ? 'success'
                              : booking.status === 'Usada'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="text-[11px] px-2 py-0.5 shrink-0"
                        >
                          {booking.status}
                        </Badge>
                      </div>
                      {booking.status === 'Confirmada' && (
                        <AccessWindowIndicator
                          compact
                          date={booking.date}
                          time={booking.time}
                          accessWindowStart={booking.accessWindowStart}
                          accessWindowEnd={booking.accessWindowEnd}
                        />
                      )}
                      <span className="text-xs text-[var(--subtle)] flex flex-wrap items-center gap-2 mt-1">
                        <span>
                          <strong className="text-[var(--ink)] font-semibold">{booking.code}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          {formatDate(booking.date)}, {booking.time}
                        </span>
                        <span>·</span>
                        <span>Sede {booking.sede}</span>
                        <span>·</span>
                        <span>{formatMoney(booking.amount)} COP</span>
                      </span>
                    </div>

                    <div className="portal-ticket-actions">
                      {isConfirmed && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenQrModal(booking)}
                            className="action-button text-xs py-2 px-3.5 gap-2"
                          >
                            <QrCode size={15} /> Ver QR de Acceso
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadQr(booking)}
                            disabled={downloadingId === booking.id}
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                            title="Descargar imagen QR transferible (PNG)"
                          >
                            <Download size={14} /> Descargar QR
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintTicket(booking)}
                            disabled={isPrinting}
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                            title="Imprimir comprobante en formato térmico 58mm"
                          >
                            <Printer size={14} /> Imprimir Recibo (58mm)
                          </button>
                          <Link
                            href="/confirmation"
                            onClick={() => setLastCode(booking.code)}
                            className="calendar-shortcut text-xs py-2 px-3"
                          >
                            Pase Digital <ArrowRight size={13} />
                          </Link>
                        </>
                      )}
                      {!isConfirmed && (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintTicket(booking)}
                            disabled={isPrinting}
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                          >
                            <Printer size={14} /> Imprimir Recibo (58mm)
                          </button>
                          <Link href="/services" className="calendar-shortcut text-xs py-2 px-3">
                            Reservar de nuevo <ArrowRight size={13} />
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal QR de Alta Definición */}
      {selectedTicket && (
        <div
          className="qr-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ticket-qr-modal-title"
          onClick={() => setSelectedTicket(null)}
        >
          <div className="qr-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modal-close"
              aria-label="Cerrar modal de QR"
              onClick={() => setSelectedTicket(null)}
            >
              <X size={18} />
            </button>

            <span className="eyebrow justify-center text-xs">PASE DE ACCESO DIGITAL</span>
            <h2 id="ticket-qr-modal-title" className="text-xl font-bold tracking-tight mt-1 mb-1">
              {selectedTicket.service}
            </h2>
            <p className="text-xs text-[var(--subtle)]">
              Sede {selectedTicket.sede} · {formatDate(selectedTicket.date)}, {selectedTicket.time}
            </p>

            <QRGraphicHD
              code={selectedTicket.qrPayload || selectedTicket.code}
              dataUrl={selectedTicket.qrDataUrl}
            />

            <AccessWindowIndicator
              date={selectedTicket.date}
              time={selectedTicket.time}
              accessWindowStart={selectedTicket.accessWindowStart}
              accessWindowEnd={selectedTicket.accessWindowEnd}
            />

            <div className="mt-2 mb-3">
              <b className="text-lg font-mono tracking-widest block text-[var(--ink)]">
                {selectedTicket.code}
              </b>
              <span className="text-xs text-[var(--subtle)] mt-0.5 block">
                Titular: <strong>{selectedTicket.client}</strong> · {selectedTicket.attendees}{' '}
                {selectedTicket.attendees === 1 ? 'cupo' : 'cupos'}
              </span>
            </div>

            <div className="qr-turnstile-hint">
              <ShieldCheck size={16} className="text-[var(--brand-accent)] shrink-0" />
              <span>Pase transferible sin biometría (RF-10 / RF-12). Acerca la pantalla o la imagen al lector óptico.</span>
            </div>

            <div className="qr-modal-actions flex-wrap gap-2">
              <button
                type="button"
                className="action-button text-xs py-2 px-4 gap-2"
                disabled={downloadingId === selectedTicket.id}
                onClick={() => handleDownloadQr(selectedTicket)}
              >
                <Download size={15} /> Descargar Imagen QR (PNG)
              </button>
              <button
                type="button"
                className="calendar-shortcut text-xs py-2 px-4 gap-2"
                disabled={isPrinting}
                onClick={() => handlePrintTicket(selectedTicket)}
              >
                <Printer size={15} /> Imprimir Recibo (58mm)
              </button>
              <button
                type="button"
                className="calendar-shortcut text-xs py-2 px-4"
                onClick={() => setSelectedTicket(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprobante en formato imprimible PDF */}
      <PrintableReceipt
        ticket={printingTicket}
        qrDataUrl={printingQrUrl}
        receiptData={printingReceipt}
      />
    </>
  )
}
