'use client'

import type { ReactNode } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowRight, Download, Printer, QrCode, Ticket } from 'lucide-react'
import { formatDate, formatMoney, type Booking } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { AccessWindowIndicator } from './AccessWindowIndicator'
import type { PortalTicket } from '../utils/portal-utils'

function Link({
  href,
  children,
  className,
  onClick,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) {
  return (
    <a href={href} className={className} onClick={onClick} {...props}>
      {children}
    </a>
  )
}

export interface PortalBookingsListProps {
  activeTab: 'activas' | 'historial' | 'canceladas'
  setActiveTab: (tab: 'activas' | 'historial' | 'canceladas') => void
  activeBookings: PortalTicket[]
  historyBookings: PortalTicket[]
  cancelledBookings: PortalTicket[]
  currentTabItems: PortalTicket[]
  onOpenQR: (booking: PortalTicket) => void
  onPrintTicket: (ticket: Booking) => void
  onSelectCode: (code: string) => void
}

export function PortalBookingsList({
  activeTab,
  setActiveTab,
  activeBookings,
  historyBookings,
  cancelledBookings,
  currentTabItems,
  onOpenQR,
  onPrintTicket,
  onSelectCode,
}: PortalBookingsListProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="mt-10" aria-label="Historial de reservas del cliente">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="eyebrow text-xs">AUTOGESTIÓN Y TIQUETES (RF-12)</div>
          <h2 className="text-xl font-bold tracking-tight mt-1">Mis Pases y Reservas</h2>
        </div>
        <div className="portal-tabs-nav" role="tablist" aria-label="Filtro de reservas">
          <motion.button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activas'}
            {...(!shouldReduceMotion ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } } : {})}
            className={`portal-tab-btn relative overflow-hidden ${activeTab === 'activas' ? 'active' : ''}`}
            onClick={() => setActiveTab('activas')}
          >
            {activeTab === 'activas' && (
              <motion.span
                layoutId="activePortalTab"
                className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              Reservas Activas
              <span className="portal-tab-badge">{activeBookings.length}</span>
            </span>
          </motion.button>
          <motion.button
            type="button"
            role="tab"
            aria-selected={activeTab === 'historial'}
            {...(!shouldReduceMotion ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } } : {})}
            className={`portal-tab-btn relative overflow-hidden ${activeTab === 'historial' ? 'active' : ''}`}
            onClick={() => setActiveTab('historial')}
          >
            {activeTab === 'historial' && (
              <motion.span
                layoutId="activePortalTab"
                className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              Historial de Compras
              <span className="portal-tab-badge">{historyBookings.length}</span>
            </span>
          </motion.button>
          <motion.button
            type="button"
            role="tab"
            aria-selected={activeTab === 'canceladas'}
            {...(!shouldReduceMotion ? { whileHover: { scale: 1.02 }, whileTap: { scale: 0.98 } } : {})}
            className={`portal-tab-btn relative overflow-hidden ${activeTab === 'canceladas' ? 'active' : ''}`}
            onClick={() => setActiveTab('canceladas')}
          >
            {activeTab === 'canceladas' && (
              <motion.span
                layoutId="activePortalTab"
                className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              Canceladas
              <span className="portal-tab-badge">{cancelledBookings.length}</span>
            </span>
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        >
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
                  <motion.div
                    key={booking.id}
                    {...(!shouldReduceMotion ? { whileHover: { y: -3, transition: { type: 'spring', stiffness: 350, damping: 25 } } } : {})}
                    className="portal-ticket-item transition-colors"
                  >
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
                            onClick={() => onOpenQR(booking)}
                            className="action-button text-xs py-2 px-3.5 gap-2"
                          >
                            <QrCode size={15} /> Ver QR de Acceso
                          </button>
                          <button
                            type="button"
                            onClick={() => onPrintTicket(booking)}
                            className="calendar-shortcut text-xs py-2 px-3 gap-1.5"
                            title="Descargar comprobante en PDF"
                          >
                            <Download size={14} /> PDF
                          </button>
                          <Link
                            href="/confirmation"
                            onClick={() => onSelectCode(booking.code)}
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
                            onClick={() => onPrintTicket(booking)}
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
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  )
}
