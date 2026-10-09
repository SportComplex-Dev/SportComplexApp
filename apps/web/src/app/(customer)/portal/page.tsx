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

type TabType = 'activas' | 'historial' | 'canceladas'

function QRGraphicHD({ code }: { code: string }) {
  const blocks = useMemo(() => Array.from({ length: 441 }, (_, i) => {
    const x = i % 21
    const y = Math.floor(i / 21)
    const inEye = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
    if (inEye) {
      const ax = x < 7 ? x : x - 14
      const ay = y < 7 ? y : y - 14
      return ax === 0 || ax === 6 || ay === 0 || ay === 6 || (ax >= 2 && ax <= 4 && ay >= 2 && ay <= 4)
    }
    return (x * 7 + y * 11 + x * y * 3) % 5 < 2
  }), [])

  return (
    <div className="qr-modal-hd" aria-label={`Código QR de acceso para ticket ${code}`}>
      <div className="qr-grid-hd">
        {blocks.map((active, i) => (
          <i key={i} className={active ? 'qr-on' : ''} />
        ))}
      </div>
    </div>
  )
}

function PrintableReceipt({ ticket }: { ticket: Booking | null }) {
  if (!ticket) return null
  const subtotal = Math.round(ticket.amount / 1.19)
  const iva = ticket.amount - subtotal

  return (
    <div className="printable-receipt">
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '16px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0 0 4px 0' }}>AKROS SPORTCOMPLEX</h2>
        <p style={{ margin: 0, fontSize: '13px' }}>Complejo Deportivo y Wellness Cashless</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>NIT: 901.458.789-2 · Medellín, Colombia</p>
        <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: 'bold' }}>COMPROBANTE DE RESERVA Y PASE DIGITAL</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '13px' }}>
        <div>
          <p style={{ margin: '4px 0' }}><strong>Código de Pase:</strong> {ticket.code}</p>
          <p style={{ margin: '4px 0' }}><strong>Titular:</strong> {ticket.client}</p>
          <p style={{ margin: '4px 0' }}><strong>Servicio:</strong> {ticket.service}</p>
          <p style={{ margin: '4px 0' }}><strong>Sede:</strong> Sede {ticket.sede} · Medellín</p>
        </div>
        <div>
          <p style={{ margin: '4px 0' }}><strong>Fecha del Servicio:</strong> {formatDate(ticket.date)}</p>
          <p style={{ margin: '4px 0' }}><strong>Horario:</strong> {ticket.time}</p>
          <p style={{ margin: '4px 0' }}><strong>Capacidad / Cupos:</strong> {ticket.attendees} {ticket.attendees === 1 ? 'persona' : 'personas'}</p>
          <p style={{ margin: '4px 0' }}><strong>Estado:</strong> {ticket.status.toUpperCase()}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
            <th style={{ padding: '8px 4px' }}>Descripción</th>
            <th style={{ padding: '8px 4px', textAlign: 'right' }}>Total (COP)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '8px 4px' }}>Reserva deportiva: {ticket.service}</td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatMoney(subtotal)}</td>
          </tr>
          <tr>
            <td style={{ padding: '8px 4px' }}>IVA (19%)</td>
            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{formatMoney(iva)}</td>
          </tr>
          <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold', fontSize: '15px' }}>
            <td style={{ padding: '10px 4px' }}>TOTAL PAGADO</td>
            <td style={{ padding: '10px 4px', textAlign: 'right' }}>{formatMoney(ticket.amount)} COP</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: '30px' }}>
        <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0' }}>PRESENTA ESTE CÓDIGO EN EL TORNIQUETE O LECTOR ÓPTICO</p>
        <p style={{ fontSize: '11px', color: '#666', margin: '4px 0' }}>Código UUID: {ticket.code}</p>
        <p style={{ fontSize: '10px', color: '#888', marginTop: '16px' }}>
          * Cancelaciones y reprogramaciones gratuitas hasta 4 horas antes del horario de reserva. Pase transferible (RF-10 / RF-12).
        </p>
      </div>
    </div>
  )
}

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
    const fetchHistory = async () => {
      try {
        const statuses = ['CONFIRMADA', 'EXPIRADA', 'CANCELADA_ADMINISTRATIVA']
        const requests = statuses.map((status) =>
          fetch(`/api/bookings/history?status=${status}&limit=20`)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        )
        const results = await Promise.all(requests)
        if (!isMounted) return

interface ApiBookingHistoryItem {
  id: string
  estado: string
  cantidadCupos?: number
  total?: number | string
  ticketQr?: { codigoUuid?: string } | null
  disponibilidad?: {
    fecha?: string | Date
    franja?: { horaInicio: string; horaFin: string } | null
    servicio?: { nombre: string; tipo: string } | null
  } | null
  pago?: { metodo?: string; referenciaExterna?: string } | null
}

function formatSlotTime(raw: string | undefined): string {
  if (!raw) return '07:00 a. m.'
  if (raw.includes('T')) {
    const timePart = raw.split('T')[1]?.slice(0, 5)
    if (timePart) {
      const [h, m] = timePart.split(':').map(Number)
      const period = h >= 12 ? 'p. m.' : 'a. m.'
      const hour12 = h % 12 || 12
      return `${hour12}:${String(m).padStart(2, '0')} ${period}`
    }
  }
  return raw
}

        const merged: Booking[] = []
        results.forEach((res) => {
          if (res?.success && Array.isArray(res.data?.items)) {
            res.data.items.forEach((item: ApiBookingHistoryItem) => {
              const statusMap: Record<string, Booking['status']> = {
                CONFIRMADA: 'Confirmada',
                EXPIRADA: 'Usada',
                CANCELADA_ADMINISTRATIVA: 'Cancelada',
              }
              const inicio = formatSlotTime(item.disponibilidad?.franja?.horaInicio)
              const fin = formatSlotTime(item.disponibilidad?.franja?.horaFin)
              const rawTotal = typeof item.total === 'number' ? item.total : typeof item.total === 'string' ? parseFloat(item.total) : 45000
              const safeTotal = isNaN(rawTotal) ? 45000 : rawTotal

              merged.push({
                id: item.id,
                code: item.ticketQr?.codigoUuid
                  ? `ALT-${item.ticketQr.codigoUuid.slice(0, 8).toUpperCase()}`
                  : `ALT-${item.id.slice(0, 8).toUpperCase()}`,
                client: session?.name ?? 'Cliente',
                category: item.disponibilidad?.servicio?.tipo?.toLowerCase() ?? 'canchas',
                service: item.disponibilidad?.servicio?.nombre ?? 'Espacio deportivo',
                sede: 'Laureles',
                date: item.disponibilidad?.fecha ? String(item.disponibilidad.fecha).slice(0, 10) : '2026-10-09',
                time: item.disponibilidad?.franja ? `${inicio} — ${fin}` : '07:00 a. m.',
                attendees: item.cantidadCupos ?? 1,
                amount: safeTotal,
                status: statusMap[item.estado] ?? 'Confirmada',
                paymentMethod: item.pago?.metodo ?? 'card',
                transactionRef: item.pago?.referenciaExterna ?? undefined,
              })
            })
          }
        })



        if (merged.length > 0) {
          setDbBookings(merged)
        }
      } catch {
        // Fallback transparente a reservas locales
      }
    }

    fetchHistory()
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

  // Próxima reserva activa para el banner destacado
  const next = useMemo(() => {
    return allBookings
      .filter((b) => b.status === 'Confirmada')
      .sort((a, b) => a.date.localeCompare(b.date))[0]
  }, [allBookings])

  // Filtrado según pestañas requeridas en RF-12
  const activeBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === 'Confirmada')
  }, [allBookings])

  const historyBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === 'Usada' || b.status === 'Pendiente')
  }, [allBookings])

  const cancelledBookings = useMemo(() => {
    return allBookings.filter((b) => b.status === 'Cancelada')
  }, [allBookings])

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

  // Generar / Imprimir comprobante PDF
  const handlePrintTicket = useCallback((ticket: Booking) => {
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
      <PrintableReceipt ticket={printingTicket} />
    </>
  )
}
