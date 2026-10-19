'use client'

import { useApp } from '@/components/layout/app-provider'
import {
  PosCatalogSelector,
  PosClientForm,
  PosPaymentStripe,
  PosVoucherModal,
  PosAltLinkModal,
  PosHeader,
  usePosSession,
} from '@sportcomplex/features-pos'

export default function PosPage() {
  const { session, notify, logout } = useApp()
  const pos = usePosSession({ notify })

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] pb-16">
      <PosHeader
        sellerName={session?.name || 'Andrés Muñoz'}
        sellerRole={session?.role || 'Empleado_Vendedor'}
        onLogout={logout}
      />

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 flex flex-col gap-5">
            <PosCatalogSelector
              selectedCategory={pos.selectedCategory} onSelectCategory={pos.setSelectedCategory}
              selectedServiceId={pos.selectedServiceId} onSelectServiceId={pos.setSelectedServiceId}
              selectedDate={pos.selectedDate} onSelectDate={pos.setSelectedDate}
              selectedSlot={pos.selectedSlot} onSelectSlot={pos.setSelectedSlot}
              attendees={pos.attendees} onSetAttendees={pos.setAttendees}
              filteredServices={pos.filteredServices} currentService={pos.currentService}
              todayStr={pos.todayStr} availableSlots={pos.availableSlots} isLoadingSlots={pos.isLoadingSlots}
            />
          </div>

          <div className="lg:col-span-3 flex flex-col gap-5">
            <PosClientForm
              clientDoc={pos.clientDoc} onClientDocChange={pos.setClientDoc}
              clientName={pos.clientName} onClientNameChange={pos.setClientName}
              clientEmail={pos.clientEmail} onClientEmailChange={pos.setClientEmail}
              clientPhone={pos.clientPhone} onClientPhoneChange={pos.setClientPhone}
              isMember={pos.isMember} onIsMemberChange={pos.setIsMember}
              onQuickWalkIn={pos.handleQuickWalkIn}
            />
          </div>

          <div className="lg:col-span-4 flex flex-col gap-5">
            <PosPaymentStripe
              currentService={pos.currentService} subtotalBruto={pos.subtotalBruto}
              descuentoMonto={pos.descuentoMonto} subtotalNeto={pos.subtotalNeto}
              ivaMonto={pos.ivaMonto} totalFinal={pos.totalFinal} isMember={pos.isMember}
              isProcessing={pos.isProcessing} processStep={pos.processStep}
              onProcessPayment={pos.handleProcessStripePayment}
              onGenerateAltLink={pos.handleGenerateAltLink}
            />
          </div>
        </div>
      </div>

      {pos.confirmedBooking && (
        <PosVoucherModal
          booking={pos.confirmedBooking} sellerName={session?.name}
          receiptQrUrl={pos.receiptQrUrl} onPrint={() => window.print()}
          onNextSale={pos.handleResetForNextSale}
        />
      )}

      <PosAltLinkModal
        isOpen={pos.isAltLinkModalOpen} onClose={() => pos.setIsAltLinkModalOpen(false)}
        altLinkUrl={pos.altLinkUrl} altLinkQrUrl={pos.altLinkQrUrl}
        copiedLink={pos.copiedLink} onCopyLink={pos.handleCopyLink}
      />
    </main>
  )
}
