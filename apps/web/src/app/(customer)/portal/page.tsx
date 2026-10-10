'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  Download,
  Printer,
  QrCode,
  ShieldCheck,
  Sparkles,
  Ticket,
  X,
} from 'lucide-react'

import {
  formatDate,
  formatMoney,
  minPrice,
  serviceCategories,
  type Booking,
} from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { categoryIcons } from '@/components/category-icons'
import { IconBox } from '@/components/icon-box'
import { useApp } from '@/components/app-provider'
import { useBookings, useCatalog, useLastCode } from '@/lib/stores'
import { useToday } from '@/lib/persistent-state'
import {
  clasificarReservas,
  fetchCustomerBookingHistory,
  generarQRDataUrl,
  obtenerProximaReserva,
} from '@/components/portal/portal-utils'
import { QRGraphicHD } from '@/components/portal/qr-modal'
import { PrintableReceipt } from '@/components/portal/printable-receipt'

type TabType = 'activas' | 'historial' | 'canceladas'


export default function CustomerDashboardPage() {
  const { session } = useApp()
  const [catalog] = useCatalog()
  const [localBookings] = useBookings()
  const [, setLastCode] = useLastCode()
  const today = useToday()

  // Tabs de HU-13 / RF-12: Activas, Historial, Canceladas
  const [activeTab, setActiveTab] = useState<TabType>('activas')
  const [selectedTicket, setSelectedTicket] = useState<Booking | null>(null)
  const [printingTicket, setPrintingTicket] = useState<Booking | null>(null)
  const [dbBookings, setDbBookings] = useState<Booking[]>([])

  // Cargar historial real desde el endpoint TSK-BE-13 (/api/bookings/history)
  useEffect(() => {
    let isMounted = true
    fetchCustomerBookingHistory(session?.name ?? 'Cliente')
      .then((items) => {
        if (isMounted && items.length > 0) {
          setDbBookings(items)
        }
      })
      .catch(() => {
        // Fallback transparente a reservas locales
      })

    return () => {
      isMounted = false
    }
  }, [session])

  // Combinar reservas de base de datos con locales para persistencia en demo
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

  // Próxima reserva activa para el banner destacado (filtra reservas pasadas)
  const next = useMemo(() => {
    return obtenerProximaReserva(allBookings, today)
  }, [allBookings, today])

  // Filtrado según pestañas requeridas en RF-12
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
    }
  }, [activeTab, activeBookings, historyBookings, cancelledBookings])

  // Generar / Imprimir comprobante PDF con código QR renderizado
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

  const available = catalog.filter((item) => item.status === 'Disponible').length
  const userName = session?.name ? session.name.split(' ').slice(0, 2).join(' ') : 'Cliente'

  return (
    <>
      <main className="section-shell app-page no-print">
        {/* Cabecera de bienvenida personalizada */}
        <div className="welcome-row">
          <div>
            <div className="eyebrow">
              <span className="live-dot" /> {today ? formatDate(today).toUpperCase() : 'BOGOTÁ, COLOMBIA'}
            </div>
            <h1>
              Hola, {userName} <Sparkles aria-hidden="true" />
            </h1>
            <p>Un gran día para moverte. Gestiona tus reservas y accede a tus pases deportivos.</p>
          </div>
          <Link href="/services" className="calendar-shortcut">
            <CalendarDays size={17} /> Reservar un espacio
          </Link>
        </div>

        {/* Tarjeta de Próxima Reserva Destacada */}
        {next ? (
          <div className="dashboard-appointment">
            <div className="appointment-icon">
              <CalendarCheck size={21} />
            </div>
            <div className="appointment-info">
              <span>TU PRÓXIMA RESERVA</span>
              <b>{next.service}</b>
              <small>
                {formatDate(next.date)}, {next.time} <i>·</i> Sede {next.sede}
              </small>
            </div>
            <div className="appointment-count">
              <b>{formatMoney(next.amount)}</b>
              <small>
                {next.category === 'canchas'
                  ? 'Cancha completa'
                  : `${next.attendees} ${next.attendees === 1 ? 'asistente' : 'asistentes'}`}
              </small>
            </div>
            <button
              type="button"
              className="appointment-arrow"
              aria-label="Ver pase de acceso"
              onClick={() => setSelectedTicket(next)}
            >
              <QrCode size={19} />
            </button>
          </div>
        ) : (
          <div className="dashboard-empty">
            <span className="empty-icon">
              <CalendarDays size={21} />
            </span>
            <div>
              <b>Aún no tienes reservas programadas</b>
              <p>Encuentra un espacio y empieza a planear tu próximo partido o sesión de entrenamiento.</p>
            </div>
            <Link href="/services">
              Explorar servicios <ArrowRight size={15} />
            </Link>
          </div>
        )}

        {/* Panel de Autogestión con Pestañas (RF-12 / TSK-FE-13) */}
        <section className="mt-10" aria-label="Historial de reservas del cliente">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div>
              <div className="eyebrow text-xs">AUTOGESTIÓN Y TIQUETES (RF-12)</div>
              <h2 className="text-xl font-bold tracking-tight mt-1">Mis Pases y Reservas</h2>
            </div>
            <div className="portal-tabs-nav">
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'activas' ? 'active' : ''}`}
                onClick={() => setActiveTab('activas')}
              >
                Reservas Activas
                <span className="portal-tab-badge">{activeBookings.length}</span>
              </button>
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'historial' ? 'active' : ''}`}
                onClick={() => setActiveTab('historial')}
              >
                Historial de Compras
                <span className="portal-tab-badge">{historyBookings.length}</span>
              </button>
              <button
                type="button"
                className={`portal-tab-btn ${activeTab === 'canceladas' ? 'active' : ''}`}
                onClick={() => setActiveTab('canceladas')}
              >
                Canceladas
                <span className="portal-tab-badge">{cancelledBookings.length}</span>
              </button>
            </div>
          </div>

          {/* Listado de Reservas de la Pestaña Activa */}
          {currentTabItems.length === 0 ? (
            <div className="demo-card text-center py-12">
              <Ticket size={36} className="mx-auto text-[var(--subtle)] mb-3 opacity-60" />
              <b className="block text-base">No hay reservas en esta categoría</b>
              <p className="text-sm text-[var(--subtle)] mt-1 mb-5">
                {activeTab === 'activas'
                  ? 'No cuentas con reservas vigentes en este momento.'
                  : activeTab === 'historial'
                  ? 'Aún no registras historial de reservas anteriores.'
                  : 'No tienes reservas canceladas en tu registro.'}
              </p>
              <Link href="/services" className="action-button text-xs py-2 px-4">
                Explorar catálogo <ArrowRight size={14} />
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

        {/* Sección Hecho para Ti: Catálogo de Servicios */}
        <div className="section-heading dashboard-heading">
          <div>
            <div className="eyebrow">HECHO PARA TI</div>
            <h2>
              ¿Qué hacemos <span>hoy?</span>
            </h2>
          </div>
          <span className="open-status">
            <i /> {available} espacios disponibles ahora
          </span>
        </div>

        <div className="dashboard-category-grid">
          {serviceCategories.map(({ slug, name, description, icon, tone, unit }) => {
            const from = minPrice(catalog, slug)
            return (
              <Link href={`/services/${slug}`} key={slug} className="dashboard-category">
                <IconBox icon={categoryIcons[icon]} tone={tone} />
                <span className="dash-card-arrow">
                  <ArrowRight size={16} />
                </span>
                <h3>{name}</h3>
                <p>{description}</p>
                <div className="dashboard-price">
                  {from ? (
                    <>
                      Desde {formatMoney(from)}
                      <span>/ {unit}</span>
                    </>
                  ) : (
                    'Próximamente'
                  )}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Zona inferior de promociones y soporte */}
        <div className="dashboard-bottom">
          <div className="dashboard-promo">
            <div className="promo-copy">
              <div className="eyebrow">ALTURA PARA TODOS</div>
              <h3>
                Activa tu energía.
                <br />
                Conoce nuestros espacios deportivos.
              </h3>
              <Link href="/services" className="text-link">
                Ver todos los servicios <ArrowRight size={15} />
              </Link>
            </div>
          </div>
          <div className="mini-tip">
            <IconBox icon={ShieldCheck} tone="lime" />
            <div>
              <b>Reserva con confianza</b>
              <p>Cambios o cancelaciones gratis hasta 4 horas antes.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Modal QR de Alta Definición para Torniquetes (RF-12 / RF-10) */}
      {selectedTicket && (
        <div
          className="qr-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
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
            <h2 id="qr-modal-title" className="text-xl font-bold tracking-tight mt-1 mb-1">
              {selectedTicket.service}
            </h2>
            <p className="text-xs text-[var(--subtle)]">
              Sede {selectedTicket.sede} · {formatDate(selectedTicket.date)}, {selectedTicket.time}
            </p>

            {/* Código QR en Alta Definición */}
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
