'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
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
    /** INT-01: payload QR firmado SC1 generado por el servidor */
    ticketQrPayload?: string | null
    ticket?: { id?: string; codigo?: string; codigoUuid?: string; qrPayload?: string }
  }
}

export default function TicketsPage() {
  const { session, notify } = useApp()
  const shouldReduceMotion = useReducedMotion()
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
            <div className="portal-tabs-nav" role="tablist" aria-label="Filtro de tiquetes">
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeTab === 'activas'}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`portal-tab-btn relative overflow-hidden ${activeTab === 'activas' ? 'active' : ''}`}
                onClick={() => setActiveTab('activas')}
              >
                {activeTab === 'activas' && (
                  <motion.span
                    layoutId="activeTicketsTab"
                    className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  Pases Activos
                  <span className="portal-tab-badge">{activeBookings.length}</span>
                </span>
              </motion.button>
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeTab === 'historial'}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`portal-tab-btn relative overflow-hidden ${activeTab === 'historial' ? 'active' : ''}`}
                onClick={() => setActiveTab('historial')}
              >
                {activeTab === 'historial' && (
                  <motion.span
                    layoutId="activeTicketsTab"
                    className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  Historial
                  <span className="portal-tab-badge">{historyBookings.length}</span>
                </span>
              </motion.button>
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeTab === 'canceladas'}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`portal-tab-btn relative overflow-hidden ${activeTab === 'canceladas' ? 'active' : ''}`}
                onClick={() => setActiveTab('canceladas')}
              >
                {activeTab === 'canceladas' && (
                  <motion.span
                    layoutId="activeTicketsTab"
                    className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  Cancelados
                  <span className="portal-tab-badge">{cancelledBookings.length}</span>
                </span>
              </motion.button>
              <motion.button
                type="button"
                role="tab"
                aria-selected={activeTab === 'torneos'}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                className={`portal-tab-btn relative overflow-hidden ${activeTab === 'torneos' ? 'active' : ''}`}
                onClick={() => setActiveTab('torneos')}
              >
                {activeTab === 'torneos' && (
                  <motion.span
                    layoutId="activeTicketsTab"
                    className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                    transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Trophy size={13} className="text-amber-500 inline-block mr-0.5" />
                  Torneos
                  <span className="portal-tab-badge">{userTournaments.length}</span>
                </span>
              </motion.button>
            </div>

            <Link href="/services" className="calendar-shortcut text-xs py-2.5 px-3.5 gap-2 w-full md:w-auto justify-center">
              <Ticket size={14} /> Reservar nuevo espacio <ArrowRight size={13} />
            </Link>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
            >
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
                  // INT-01: Priorizar el payload QR firmado SC1 entregado por el servidor.
                  // El escáner solo puede validar el formato SC1:<uuid>:<hmac>, NO el UUID crudo.
                  const qrPayload = ins?.ticketQrPayload || ins?.ticket?.qrPayload || null
                  // El código legible para el usuario sigue siendo el UUID (display), pero el QR usa el payload firmado
                  const ticketCode = ins?.ticketCodigoUuid || ins?.ticket?.codigoUuid || (isConfirmed ? `TRN-${tournament.id.slice(0, 8)}` : 'PENDIENTE')
                  // INT-01: El ID para recuperar el comprobante debe ser el ID de la inscripción, no del torneo
                  const inscripcionId = ins?.id || tournament.id
                  const precioNum = Number(tournament.precioInscripcion ?? 0)

                  const handleOpenTournamentQR = () => {
                    const fakeBooking: PortalTicket = {
                      id: inscripcionId,
                      code: ticketCode,
                      // INT-01: El qrPayload firmado asegura que el escáner acepte el QR
                      qrPayload: qrPayload ?? undefined,
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
                    const fakeBooking: PortalTicket = {
                      // INT-01: usar ID de la inscripción para que fetchReceiptData consulte el comprobante correcto
                      id: inscripcionId,
                      code: ticketCode,
                      // INT-01: el qrPayload firmado SC1 es el único aceptado por el escáner
                      qrPayload: qrPayload ?? undefined,
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
          </motion.div>
        </AnimatePresence>
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
