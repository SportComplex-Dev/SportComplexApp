'use client'

import Link from 'next/link'
import { CalendarDays, Sparkles } from 'lucide-react'
import { formatDate } from '@sportcomplex/core'
import { useApp } from '@/components/app-provider'
import { useLastCode } from '@/lib/stores'
import { useToday } from '@/lib/persistent-state'
import { usePublicCatalog } from '@/hooks/use-public-catalog'
import { PrintableReceipt } from '@/components/portal/printable-receipt'

import { useCustomerPortal } from '@/app/(customer)/portal/hooks/use-customer-portal'
import { UpcomingBookingCard } from '@/app/(customer)/portal/components/upcoming-booking-card'
import { PortalBookingsList } from '@/app/(customer)/portal/components/portal-bookings-list'
import { CategoryShowcase } from '@/app/(customer)/portal/components/category-showcase'
import { PortalQrModal } from '@/app/(customer)/portal/components/portal-qr-modal'

export default function CustomerDashboardPage() {
  const { session } = useApp()
  const { catalog } = usePublicCatalog()
  const [, setLastCode] = useLastCode()
  const today = useToday()

  const {
    activeTab, setActiveTab, next, activeBookings, historyBookings,
    cancelledBookings, currentTabItems, selectedTicket, setSelectedTicket,
    printingTicket, printingQrUrl, handlePrintTicket,
  } = useCustomerPortal(session?.name, today)

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
            <h1>Hola, {userName} <Sparkles aria-hidden="true" /></h1>
            <p>Un gran día para moverte. Gestiona tus reservas y accede a tus pases deportivos.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/portal/membership" className="calendar-shortcut border-[#c9ef75]/40 text-[#557b53] dark:text-[#c9ef75]">
              <Sparkles size={16} className="text-[#c9ef75]" /> Membresías · 30% OFF en Reservas
            </Link>
            <Link href="/services" className="calendar-shortcut">
              <CalendarDays size={17} /> Reservar un espacio
            </Link>
          </div>
        </div>

        {/* Tarjeta de Próxima Reserva Destacada */}
        <UpcomingBookingCard booking={next} onOpenQR={setSelectedTicket} />

        {/* Panel de Autogestión con Pestañas (RF-12 / TSK-FE-13) */}
        <PortalBookingsList
          activeTab={activeTab} setActiveTab={setActiveTab}
          activeBookings={activeBookings} historyBookings={historyBookings}
          cancelledBookings={cancelledBookings} currentTabItems={currentTabItems}
          onOpenQR={setSelectedTicket} onPrintTicket={handlePrintTicket} onSelectCode={setLastCode}
        />

        {/* Sección Hecho para Ti: Catálogo de Servicios */}
        <CategoryShowcase catalog={catalog} />
      </main>

      {/* Modal QR de Alta Definición para Torniquetes (RF-12 / RF-10) */}
      <PortalQrModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onPrint={handlePrintTicket} />

      {/* Comprobante en formato imprimible PDF */}
      <PrintableReceipt ticket={printingTicket} qrDataUrl={printingQrUrl} />
    </>
  )
}
