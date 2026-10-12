'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import { AlertCircle, ShieldCheck, Store, User } from 'lucide-react'

import {
  type Booking,
  type CatalogItem,
} from '@sportcomplex/core'
import { useApp } from '@/components/app-provider'
import { useBookings, useCatalog } from '@/lib/stores'
import { calcularDesgloseComprobante } from '@/components/portal/portal-utils'

import { PosCatalogSelector } from './components/pos-catalog-selector'
import { PosClientForm } from './components/pos-client-form'
import { PosPaymentStripe } from './components/pos-payment-stripe'
import { PosVoucherModal } from './components/pos-voucher-modal'
import { PosAltLinkModal } from './components/pos-alt-link-modal'

// Franjas horarias por defecto para la taquilla (06:00 a. m. a 09:00 p. m.)
const defaultTimeSlots = [
  '06:00 a. m. - 07:00 a. m.',
  '07:00 a. m. - 08:00 a. m.',
  '08:00 a. m. - 09:00 a. m.',
  '09:00 a. m. - 10:00 a. m.',
  '10:00 a. m. - 11:00 a. m.',
  '11:00 a. m. - 12:00 m.',
  '02:00 p. m. - 03:00 p. m.',
  '03:00 p. m. - 04:00 p. m.',
  '04:00 p. m. - 05:00 p. m.',
  '05:00 p. m. - 06:00 p. m.',
  '06:00 p. m. - 07:00 p. m.',
  '07:00 p. m. - 08:00 p. m.',
  '08:00 p. m. - 09:00 p. m.',
]

export default function PosPage() {
  const { session, notify } = useApp()
  const [catalog] = useCatalog()
  const [bookings, setBookings] = useBookings()

  // Selección de categoría y servicio
  const [selectedCategory, setSelectedCategory] = useState<string>('canchas')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  // Selección de fecha y franja
  const todayStr = useMemo(() => {
    const d = new Date()
    return d.toISOString().split('T')[0]
  }, [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [selectedSlot, setSelectedSlot] = useState<string>('08:00 a. m. - 09:00 a. m.')
  const [availableSlots, setAvailableSlots] = useState<string[]>(defaultTimeSlots)
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false)
  const [attendees, setAttendees] = useState<number>(1)

  // Datos del cliente en mostrador
  const [clientName, setClientName] = useState<string>('')
  const [clientDoc, setClientDoc] = useState<string>('')
  const [clientEmail, setClientEmail] = useState<string>('')
  const [clientPhone, setClientPhone] = useState<string>('')
  const [isMember, setIsMember] = useState<boolean>(false)

  // Estados de proceso
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [processStep, setProcessStep] = useState<string>('')
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null)
  const [receiptQrUrl, setReceiptQrUrl] = useState<string | null>(null)

  // Modal de enlace alternativo (mitigación de Riesgo 2 SRS §11.1)
  const [isAltLinkModalOpen, setIsAltLinkModalOpen] = useState<boolean>(false)
  const [altLinkUrl, setAltLinkUrl] = useState<string>('')
  const [altLinkQrUrl, setAltLinkQrUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)

  // Filtrado de servicios según categoría
  const filteredServices = useMemo(() => {
    return catalog.filter((item) => item.category === selectedCategory && item.status === 'Disponible')
  }, [catalog, selectedCategory])

  // Servicio seleccionado actualmente
  const currentService = useMemo<CatalogItem | undefined>(() => {
    if (selectedServiceId) {
      return catalog.find((item) => item.id === selectedServiceId)
    }
    return filteredServices[0]
  }, [catalog, selectedServiceId, filteredServices])

  // Establecer primer servicio al cambiar categoría
  useEffect(() => {
    if (filteredServices.length > 0 && (!selectedServiceId || !filteredServices.some((s) => s.id === selectedServiceId))) {
      setSelectedServiceId(filteredServices[0].id)
    }
  }, [filteredServices, selectedServiceId])

  // Consultar disponibilidad real del backend si está disponible (RF-05 / RF-17)
  useEffect(() => {
    if (!currentService) return
    let active = true

    async function fetchAvailability() {
      setIsLoadingSlots(true)
      try {
        const res = await fetch(`/api/bookings?serviceId=${currentService?.id}&date=${selectedDate}`)
        if (res.ok && active) {
          const json = await res.json()
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const backendSlots = json.data.map((item: any) => `${item.franja.horaInicio} - ${item.franja.horaFin}`)
            setAvailableSlots(backendSlots)
            if (!backendSlots.includes(selectedSlot)) {
              setSelectedSlot(backendSlots[0])
            }
            return
          }
        }
      } catch {
        // En entorno local o sin BD usar defaultTimeSlots
      } finally {
        if (active) setIsLoadingSlots(false)
      }
      if (active) setAvailableSlots(defaultTimeSlots)
    }

    void fetchAvailability()
    return () => {
      active = false
    }
  }, [currentService, selectedDate, selectedSlot])

  // Cálculo financiero (RN-08: descuento del 30% verificado en servidor)
  const { subtotalBruto, descuentoMonto, totalFinal, subtotalNeto, ivaMonto } = useMemo(() => {
    if (!currentService) {
      return { subtotalBruto: 0, descuentoMonto: 0, totalFinal: 0, subtotalNeto: 0, ivaMonto: 0 }
    }
    const isCourt = currentService.category === 'canchas'
    const isPrivatePool = currentService.category === 'piscinas' && currentService.poolType === 'PRIVADA'
    const effectiveQty = isCourt || isPrivatePool ? 1 : Math.max(1, attendees)
    const base = currentService.price * effectiveQty
    const desc = isMember ? Math.round(base * 0.3) : 0
    const final = base - desc
    const { subtotal, iva } = calcularDesgloseComprobante(final)
    return {
      subtotalBruto: base,
      descuentoMonto: desc,
      totalFinal: final,
      subtotalNeto: subtotal,
      ivaMonto: iva,
    }
  }, [currentService, attendees, isMember])

  // Asignar cliente ocasional rápido (Walk-in)
  const handleQuickWalkIn = () => {
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString()
    setClientName('Cliente Mostrador')
    setClientDoc(randomId)
    setClientEmail(`mostrador.${randomId.slice(-4)}@akros.co`)
    setClientPhone('3001234567')
    setIsMember(false)
    notify('Datos de cliente rápido cargados para venta ágil.', 'info')
  }

  // Cobro presencial 100% Cashless con Stripe (Cumplimiento PCI-DSS / SEC-01 & TSK-BE-18)
  const handleProcessStripePayment = async () => {
    if (!currentService) {
      notify('Por favor selecciona un servicio.', 'error')
      return
    }
    if (!clientName.trim() || !clientDoc.trim() || !clientEmail.trim()) {
      notify('Ingresa el nombre, documento y correo del cliente.', 'error')
      return
    }

    setIsProcessing(true)
    setProcessStep('Creando reserva hold e iniciando cobro Stripe...')

    try {
      const payload = {
        serviceId: Number(currentService.id) || 1,
        date: selectedDate,
        slotTime: selectedSlot,
        cantidadCupos: currentService.category === 'canchas' ? 1 : attendees,
        clienteNombre: clientName.trim(),
        clienteDocumento: clientDoc.trim(),
        clienteEmail: clientEmail.trim(),
        clienteTelefono: clientPhone.trim(),
        esSocio: isMember,
        paymentMode: 'stripe_card',
      }

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // ARCH-02: NO generar reservas apócrifas si el API falla
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        const errorMsg = errJson?.error?.message || errJson?.message || 'Error al procesar el pago en taquilla.'
        throw new Error(errorMsg)
      }

      const json = await res.json()
      if (!json.success || !json.data?.booking) {
        throw new Error(json.error?.message || 'Respuesta inválida del servidor de pagos.')
      }

      const backendBooking = json.data.booking
      const paymentIntent = json.data.paymentIntent
      const clientSecret = paymentIntent?.clientSecret || paymentIntent?.client_secret

      // Confirmación oficial con Stripe (SEC-01 / ARCH-01)
      const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      if (stripePublishableKey && clientSecret && typeof window !== 'undefined') {
        setProcessStep('Confirmando transacción con datáfono digital Stripe...')
        try {
          const stripe = await loadStripe(stripePublishableKey)
          if (stripe) {
            // ARCH-REG-02: 'pm_card_visa' is a Stripe TEST-mode-only synthetic
            // payment method. With live keys (pk_live_) physical card capture
            // requires Stripe Terminal / Elements, so refuse the mock charge
            // and keep the reservation pending for the Checkout contingency link.
            const isStripeTestMode = stripePublishableKey.startsWith('pk_test_')
            if (!isStripeTestMode) {
              throw new Error(
                'Modo producción: el cobro presencial con tarjeta física requiere Stripe Terminal. ' +
                'La reserva quedó pendiente; complete el cobro con el enlace de Stripe Checkout.',
              )
            }
            const confirmResult = await stripe.confirmCardPayment(clientSecret, {
              payment_method: 'pm_card_visa',
            })
            if (confirmResult.error) {
              throw new Error(confirmResult.error.message || 'El cobro con tarjeta fue rechazado por Stripe.')
            }
          }
        } catch (stripeErr) {
          if (stripeErr instanceof Error) throw stripeErr
          throw new Error('Error al procesar la confirmación con Stripe.')
        }
      }

      setProcessStep('Verificando confirmación y emitiendo comprobante...')

      // Consultar el comprobante oficial con QR firmado por HMAC en el servidor (TSK-BE-19 / ARCH-02)
      let qrDataUrl: string | null = null
      let isConfirmed = false

      // Polling breve (hasta 3 intentos) para permitir que el webhook confirme la reserva en la BD
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const receiptRes = await fetch(`/api/pdf/receipt?reservaId=${backendBooking.id}&destinatario=POS`)
          if (receiptRes.ok) {
            const receiptJson = await receiptRes.json()
            if (receiptJson.success && receiptJson.data?.qr?.dataUrl) {
              qrDataUrl = receiptJson.data.qr.dataUrl
              isConfirmed = true
              break
            }
          }
        } catch {
          // Si falla la consulta al recibo, continuar reintentos
        }
        if (attempt < 2) {
          setProcessStep('Esperando confirmación de pasarela y emisión de pase...')
          await new Promise((resolve) => setTimeout(resolve, 600))
        }
      }

      // ARCH-02: NUNCA emitir códigos QR falsos o sin firma HMAC si el servidor no los ha emitido.
      setReceiptQrUrl(qrDataUrl)

      const newBooking: Booking = {
        id: backendBooking.id,
        code: backendBooking.code || `AKR-POS-${backendBooking.id.slice(0, 8).toUpperCase()}`,
        client: clientName,
        category: currentService.category,
        service: currentService.name,
        sede: currentService.sede,
        date: selectedDate,
        time: selectedSlot,
        attendees: currentService.category === 'canchas' ? 1 : attendees,
        amount: backendBooking.amount || totalFinal,
        status: isConfirmed ? 'Confirmada' : 'Pendiente',
        paymentMethod: 'card',
        paymentStatus: isConfirmed ? 'Aprobada' : 'Pendiente',
        transactionRef: backendBooking.stripePaymentIntentId || paymentIntent?.id || `pi_pos_${Date.now()}`,
      }

      // Persistir y abrir modal de comprobante
      setBookings([newBooking, ...bookings])
      setConfirmedBooking(newBooking)
      if (isConfirmed) {
        notify('¡Venta completada! Reserva confirmada y pase emitido.', 'success')
      } else {
        notify('Cobro iniciado en pasarela. Esperando emisión de pase de acceso.', 'info')
      }
    } catch (err: unknown) {
      console.error('Error al procesar cobro POS:', err)
      const message = err instanceof Error ? err.message : 'Error al procesar el pago en taquilla.'
      notify(message, 'error')
    } finally {
      setIsProcessing(false)
      setProcessStep('')
    }
  }

  // Generar enlace de pago alternativo (Mitigación Riesgo 2 de SRS §11.1 / ARCH-03)
  const handleGenerateAltLink = async () => {
    if (!currentService) return
    if (!clientName.trim() || !clientEmail.trim()) {
      notify('Ingresa al menos el nombre y correo del cliente.', 'error')
      return
    }

    try {
      const payload = {
        serviceId: Number(currentService.id) || 1,
        date: selectedDate,
        slotTime: selectedSlot,
        cantidadCupos: currentService.category === 'canchas' ? 1 : attendees,
        clienteNombre: clientName.trim(),
        clienteDocumento: clientDoc.trim() || '10203040',
        clienteEmail: clientEmail.trim(),
        clienteTelefono: clientPhone.trim(),
        esSocio: isMember,
        paymentMode: 'stripe_link',
      }

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      let link: string

      if (res.ok) {
        const json = await res.json()
        link = json.data?.alternativePaymentUrl || json.data?.booking?.alternativePaymentUrl
      } else {
        const tempBookingId = `pos-alt-${Date.now()}`
        link = `${origin}/checkout?session_id=${tempBookingId}&service=${encodeURIComponent(currentService.name)}&serviceId=${currentService.id}&date=${selectedDate}&time=${encodeURIComponent(selectedSlot)}&attendees=${attendees}&amount=${totalFinal}`
      }

      setAltLinkUrl(link)
      const qr = await QRCode.toDataURL(link, { width: 320, margin: 2 })
      setAltLinkQrUrl(qr)
      setIsAltLinkModalOpen(true)
    } catch (err) {
      console.error('Error al generar enlace alternativo:', err)
      notify('No se pudo generar el enlace alternativo.', 'error')
    }
  }

  const handleCopyLink = () => {
    if (altLinkUrl) {
      navigator.clipboard.writeText(altLinkUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      notify('Enlace de pago copiado al portapapeles.', 'success')
    }
  }

  // Reiniciar formulario para la siguiente venta
  const handleResetForNextSale = () => {
    setConfirmedBooking(null)
    setReceiptQrUrl(null)
    setClientName('')
    setClientDoc('')
    setClientEmail('')
    setClientPhone('')
    setIsMember(false)
    notify('Terminal listo para el siguiente cliente.', 'info')
  }

  return (
    <main className="min-h-screen bg-[var(--app-bg)] text-[var(--ink)] pb-16">
      {/* Barra de estado POS & Política Cashless */}
      <div className="bg-[#123e30] text-white px-4 py-3 shadow-md border-b border-[#1d6048]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#c9ef75] text-[#19352a] p-2 rounded-lg font-bold flex items-center gap-1.5 text-xs">
              <Store size={16} /> TAQUILLA POS
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Punto de Venta Presencial · 100% Cashless</h1>
              <p className="text-xs text-white/80">Cobro exclusivo con Stripe · Cero efectivo en mostrador (RF-17 / RN-13)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
              <User size={14} className="text-[#c9ef75]" />
              <span>Vendedor: <strong>{session?.name || 'Andrés Muñoz'}</strong></span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[#c9ef75] bg-black/20 px-3 py-1.5 rounded-lg border border-[#c9ef75]/30">
              <ShieldCheck size={15} />
              <span>Modelo 100% Sin Efectivo</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-6">
        {/* Banner de Cero Efectivo / Aviso Legal */}
        <div className="mb-6 p-4 rounded-xl border border-[#c9ef75]/40 bg-[#c9ef75]/10 flex items-start gap-3 text-sm">
          <AlertCircle size={20} className="text-[#123e30] dark:text-[#c9ef75] shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm">
            <strong className="text-[#123e30] dark:text-[#c9ef75]">Política Operativa 100% Cashless (RN-13): </strong>
            Queda estrictamente prohibida la recepción o manipulación de billetes, monedas o fondos de caja física en taquilla. Toda venta se procesa digitalmente por Stripe con tarjeta o enlace alternativo seguro.
          </div>
        </div>

        {/* Layout en 3 columnas modulares (CODE-01) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Columna 1: Selector de Servicio y Franja (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <PosCatalogSelector
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              selectedServiceId={selectedServiceId}
              onSelectServiceId={setSelectedServiceId}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              attendees={attendees}
              onSetAttendees={setAttendees}
              filteredServices={filteredServices}
              currentService={currentService}
              todayStr={todayStr}
              availableSlots={availableSlots}
              isLoadingSlots={isLoadingSlots}
            />
          </div>

          {/* Columna 2: Asociación de Cliente & Membresía (3 cols) */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <PosClientForm
              clientDoc={clientDoc}
              onClientDocChange={setClientDoc}
              clientName={clientName}
              onClientNameChange={setClientName}
              clientEmail={clientEmail}
              onClientEmailChange={setClientEmail}
              clientPhone={clientPhone}
              onClientPhoneChange={setClientPhone}
              isMember={isMember}
              onIsMemberChange={setIsMember}
              onQuickWalkIn={handleQuickWalkIn}
            />
          </div>

          {/* Columna 3: Cobro Cashless Stripe & Datáfono Digital (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <PosPaymentStripe
              currentService={currentService}
              subtotalBruto={subtotalBruto}
              descuentoMonto={descuentoMonto}
              subtotalNeto={subtotalNeto}
              ivaMonto={ivaMonto}
              totalFinal={totalFinal}
              isMember={isMember}
              isProcessing={isProcessing}
              processStep={processStep}
              onProcessPayment={handleProcessStripePayment}
              onGenerateAltLink={handleGenerateAltLink}
            />
          </div>
        </div>
      </div>

      {/* Modal de Confirmación y Comprobante Térmico / PDF (RF-17 / RNF-05) */}
      {confirmedBooking && (
        <PosVoucherModal
          booking={confirmedBooking}
          sellerName={session?.name}
          receiptQrUrl={receiptQrUrl}
          onPrint={() => window.print()}
          onNextSale={handleResetForNextSale}
        />
      )}

      {/* Modal de Enlace de Pago Alternativo (Mitigación Riesgo 2 SRS §11.1) */}
      <PosAltLinkModal
        isOpen={isAltLinkModalOpen}
        onClose={() => setIsAltLinkModalOpen(false)}
        altLinkUrl={altLinkUrl}
        altLinkQrUrl={altLinkQrUrl}
        copiedLink={copiedLink}
        onCopyLink={handleCopyLink}
      />
    </main>
  )
}
