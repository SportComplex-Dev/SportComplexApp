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
  type Booking,
} from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { useBookings, useLastCode } from '@/lib/stores'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  generarQRDataUrl,
} from '@/components/portal/portal-utils'
import { QRGraphicHD } from '@/components/portal/qr-modal'
import { PrintableReceipt } from '@/components/portal/printable-receipt'

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
    ticket?: { id: string; codigo: string }
  }
}

export default function TicketsPage() {
  const { session } = useApp()
  const [localBookings] = useBookings()
  const [, setLastCode] = useLastCode()
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null)
  const [printingTicket, setPrintingTicket] = useState<Booking | null>(null)
  const [dbBookings, setDbBookings] = useState<Booking[]>([])
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

    // Cargar torneos en los que el usuario se ha inscrito
    fetch('/api/tournaments')
      .then((res) => res.json())
      .then(async (json) => {
        if (!isMounted || !json.success || !Array.isArray(json.data)) return
        const registered = json.data.filter((t: { yaInscrito?: boolean }) => t.yaInscrito)
        if (registered.length === 0) return

        const detailed = await Promise.all(
          registered.map(async (t: { id: string }) => {
            try {
              const r = await fetch(`/api/tournaments/${t.id}`)
              const j = await r.json()
              return j.success && j.data ? j.data : t
            } catch {
              return t
            }
          })
        )
        if (isMounted) {
          setUserTournaments(detailed)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [session])

  const allBookings = useMemo(() => {
    const combined = [...dbBookings]
    const dbCodes = new Set(dbBookings.map((b) => b.code))
    localBookings.forEach((b) => {
      if (!dbCodes.has(b.code)) {
        combined.push(b)
      }
    })
    return combined
  }, [dbBookings, localBookings])

  const [printingQrUrl, setPrintingQrUrl] = useState<string | null>(null)

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
                  const ticketCode = ins?.ticket?.codigo || `TRN-${tournament.id.slice(0, 8)}`
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

                      <div className="portal-ticket-actions">
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
                            onClick={() => setSelectedTicket(booking)}
                            className="action-button text-xs py-2 px-3.5 gap-2"
                          >
                            <QrCode size={15} /> Ver QR de Acceso
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintTicket(booking)}
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                            title="Descargar comprobante en PDF"
                          >
                            <Download size={14} /> PDF
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
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                          >
                            <Printer size={14} /> Recibo
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

            <QRGraphicHD code={selectedTicket.code} />

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
              <span>Pase transferible sin biometría. Acerca la pantalla al lector óptico del torniquete.</span>
            </div>

            <div className="qr-modal-actions">
              <button
                type="button"
                className="action-button text-xs py-2 px-4 gap-2"
                onClick={() => handlePrintTicket(selectedTicket)}
              >
                <Printer size={15} /> Imprimir / PDF
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
      <PrintableReceipt ticket={printingTicket} qrDataUrl={printingQrUrl} />
    </>
  )
}
