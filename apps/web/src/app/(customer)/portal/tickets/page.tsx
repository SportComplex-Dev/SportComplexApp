'use client'

import Link from 'next/link'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ArrowLeft, ArrowRight, Ticket, Trophy } from 'lucide-react'
import { PageHeading } from '@/components/page-heading'
import { useApp } from '@/components/app-provider'
import { useLastCode } from '@sportcomplex/shared/lib'
import {
  PrintableReceipt,
  usePortalTickets,
  TicketQrModal,
  TournamentCard,
  TicketListItem,
  type TabType,
} from '@sportcomplex/features-portal'

export default function TicketsPage() {
  const { session, notify } = useApp()
  const shouldReduceMotion = useReducedMotion()
  const [, setLastCode] = useLastCode()

  const {
    activeTab, setActiveTab, activeBookings, historyBookings, cancelledBookings,
    userTournaments, currentTabItems, selectedTicket, setSelectedTicket,
    printingTicket, printingReceipt, printingQrUrl, downloadingId, isPrinting,
    handleOpenQrModal, handlePrintTicket, handleDownloadQr,
  } = usePortalTickets(session?.name, notify)

  const tabs: [TabType, string, number, typeof Trophy | undefined][] = [
    ['activas', 'Pases Activos', activeBookings.length, undefined],
    ['historial', 'Historial', historyBookings.length, undefined],
    ['canceladas', 'Cancelados', cancelledBookings.length, undefined],
    ['torneos', 'Torneos', userTournaments.length, Trophy],
  ]

  return (
    <>
      <main className="section-shell app-page no-print">
        <Link href="/portal" className="calendar-shortcut mb-6 inline-flex text-xs py-2 px-3 gap-1.5"><ArrowLeft size={14} /> Volver a Mi Portal</Link>
        <PageHeading
          eyebrow="BILLETERA DIGITAL (RF-10 / RF-12)"
          title="Mis Tiquetes y Pases de Acceso"
          description="Consulta tus pases deportivos vigentes con código QR para torniquetes o descarga tu comprobante en formato PDF."
        />
        <section className="mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="portal-tabs-nav" role="tablist" aria-label="Filtro de tiquetes">
              {tabs.map(([key, label, count, Icon]) => {
                const isActive = activeTab === key
                return (
                  <motion.button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
                    className={`portal-tab-btn relative overflow-hidden ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(key)}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="activeTicketsTab"
                        className="absolute inset-0 bg-[#123e30] border border-[#c9ef75] rounded-xl -z-0 dark:bg-[#1a3828]"
                        transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {Icon && <Icon size={13} className="text-amber-500 inline-block mr-0.5" />}
                      {label}
                      <span className="portal-tab-badge">{count}</span>
                    </span>
                  </motion.button>
                )
              })}
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
                    {userTournaments.map((t) => (
                      <TournamentCard
                        key={t.id} tournament={t} sessionName={session?.name}
                        onOpenQR={setSelectedTicket} onPrint={handlePrintTicket}
                      />
                    ))}
                  </div>
                )
              ) : currentTabItems.length === 0 ? (
                <div className="demo-card text-center py-12">
                  <Ticket size={36} className="mx-auto text-[var(--subtle)] mb-3 opacity-60" />
                  <b className="block text-base">No hay pases registrados</b>
                  <p className="text-sm text-[var(--subtle)] mt-1 mb-5">
                    {activeTab === 'activas' ? 'No cuentas con pases activos en este momento.'
                      : activeTab === 'historial' ? 'No hay registros en tu historial de compras pasadas.'
                      : 'No tienes reservas canceladas.'}
                  </p>
                  <Link href="/services" className="action-button text-xs py-2 px-4">
                    Explorar catálogo deportivo <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3">
                  {currentTabItems.map((b) => (
                    <TicketListItem
                      key={b.id} booking={b} isPrinting={isPrinting} downloadingId={downloadingId}
                      onOpenQR={handleOpenQrModal} onDownloadQR={handleDownloadQr} onPrint={handlePrintTicket}
                      onSelectCode={setLastCode}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>

      <TicketQrModal
        selectedTicket={selectedTicket} downloadingId={downloadingId} isPrinting={isPrinting}
        onClose={() => setSelectedTicket(null)} onDownloadQr={handleDownloadQr} onPrintTicket={handlePrintTicket}
      />
      <PrintableReceipt ticket={printingTicket} qrDataUrl={printingQrUrl} receiptData={printingReceipt} />
    </>
  )
}
