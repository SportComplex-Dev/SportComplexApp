'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import type { Booking, CatalogItem } from '@sportcomplex/core'
import { calcularDesgloseComprobante } from '../services/receipt'

export type ToastKind = 'success' | 'error' | 'info'

export interface UsePosSessionProps {
  notify: (msg: string, type?: ToastKind) => void
}

export function usePosSession({ notify }: UsePosSessionProps) {
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('canchas')
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0] ?? '', [])
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false)
  const [attendees, setAttendees] = useState<number>(1)

  // Cliente
  const [clientName, setClientName] = useState<string>('')
  const [clientDoc, setClientDoc] = useState<string>('')
  const [clientEmail, setClientEmail] = useState<string>('')
  const [clientPhone, setClientPhone] = useState<string>('')
  const [isMember, setIsMember] = useState<boolean>(false)

  // Proceso y confirmación
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [processStep, setProcessStep] = useState<string>('')
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null)
  const [receiptQrUrl, setReceiptQrUrl] = useState<string | null>(null)

  // Modal alternativo
  const [isAltLinkModalOpen, setIsAltLinkModalOpen] = useState<boolean>(false)
  const [altLinkUrl, setAltLinkUrl] = useState<string>('')
  const [altLinkQrUrl, setAltLinkQrUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)

  // Carga de servicios reales desde /api/admin/services?entidad=servicios (Instrucción 5)
  useEffect(() => {
    let active = true
    async function loadServices() {
      try {
        const res = await fetch('/api/admin/services?entidad=servicios')
        if (!res.ok) throw new Error('Error al consultar servicios')
        const json = await res.json()
        if (json.success && Array.isArray(json.data) && active) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items: CatalogItem[] = json.data.map((s: any) => ({
            id: String(s.id),
            name: s.nombre,
            category: (s.categoria?.nombre?.toLowerCase() || 'canchas') as CatalogItem['category'],
            sede: 'Poblado',
            description: s.description || 'Instalación deportiva oficial',
            price: Number(s.tarifa) || 0,
            capacity: s.capacidadMaxima || 1,
            status: s.estado === 'ACTIVO' ? 'Disponible' : 'Mantenimiento',
            poolType: s.tipoPiscina || undefined,
          }))
          setCatalog(items)
        }
      } catch (err) {
        console.error('Error cargando servicios para POS:', err)
        if (active) setCatalog([])
      }
    }
    void loadServices()
    return () => {
      active = false
    }
  }, [])

  const filteredServices = useMemo(() => {
    return catalog.filter((item) => item.category === selectedCategory && item.status === 'Disponible')
  }, [catalog, selectedCategory])

  const currentService = useMemo<CatalogItem | undefined>(() => {
    if (selectedServiceId) {
      return catalog.find((item) => item.id === selectedServiceId)
    }
    return filteredServices[0]
  }, [catalog, selectedServiceId, filteredServices])

  useEffect(() => {
    if (filteredServices.length > 0 && (!selectedServiceId || !filteredServices.some((s) => s.id === selectedServiceId))) {
      const first = filteredServices[0]
      if (first) {
        setSelectedServiceId(first.id)
      }
    }
  }, [filteredServices, selectedServiceId])

  // Carga de disponibilidad real desde /api/bookings?servicioId=&fecha= (Instrucción 5)
  useEffect(() => {
    if (!currentService) return
    let active = true

    async function fetchAvailability() {
      setIsLoadingSlots(true)
      try {
        const res = await fetch(`/api/bookings?servicioId=${currentService?.id}&fecha=${selectedDate}`)
        if (res.ok && active) {
          const json = await res.json()
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const backendSlots = json.data.map((item: any) => `${item.franja.horaInicio} - ${item.franja.horaFin}`)
            setAvailableSlots(backendSlots)
            const firstSlot = backendSlots[0]
            if (firstSlot && !backendSlots.includes(selectedSlot)) {
              setSelectedSlot(firstSlot)
            }
            return
          }
        }
        const fallbackSlots = [
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
        ]
        if (active) {
          setAvailableSlots(fallbackSlots)
          if (!selectedSlot || !fallbackSlots.includes(selectedSlot)) {
            setSelectedSlot(fallbackSlots[0] ?? '')
          }
        }
      } catch {
        const fallbackSlots = [
          '07:00 a. m. - 08:00 a. m.',
          '08:00 a. m. - 09:00 a. m.',
          '09:00 a. m. - 10:00 a. m.',
          '10:00 a. m. - 11:00 a. m.',
        ]
        if (active) {
          setAvailableSlots(fallbackSlots)
          if (!selectedSlot || !fallbackSlots.includes(selectedSlot)) {
            setSelectedSlot(fallbackSlots[0] ?? '')
          }
        }
      } finally {
        if (active) setIsLoadingSlots(false)
      }
    }

    void fetchAvailability()
    return () => {
      active = false
    }
  }, [currentService, selectedDate, selectedSlot])

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

  const handleQuickWalkIn = () => {
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString()
    setClientName('Cliente Mostrador')
    setClientDoc(randomId)
    setClientEmail(`mostrador.${randomId.slice(-4)}@akros.co`)
    setClientPhone('3001234567')
    setIsMember(false)
    notify('Datos de cliente rápido cargados para venta ágil.', 'info')
  }

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

      const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      if (stripePublishableKey && clientSecret && typeof window !== 'undefined') {
        setProcessStep('Confirmando transacción con datáfono digital Stripe...')
        try {
          const stripe = await loadStripe(stripePublishableKey)
          if (stripe) {
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
      let qrDataUrl: string | null = null
      let isConfirmed = false

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
          // Reintentos
        }
        if (attempt < 2) {
          setProcessStep('Esperando confirmación de pasarela y emisión de pase...')
          await new Promise((resolve) => setTimeout(resolve, 600))
        }
      }

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

  return {
    selectedCategory, setSelectedCategory,
    selectedServiceId, setSelectedServiceId,
    todayStr, selectedDate, setSelectedDate,
    selectedSlot, setSelectedSlot,
    availableSlots, isLoadingSlots,
    attendees, setAttendees,
    clientName, setClientName,
    clientDoc, setClientDoc,
    clientEmail, setClientEmail,
    clientPhone, setClientPhone,
    isMember, setIsMember,
    isProcessing, processStep,
    confirmedBooking, receiptQrUrl,
    isAltLinkModalOpen, setIsAltLinkModalOpen,
    altLinkUrl, altLinkQrUrl, copiedLink,
    filteredServices, currentService,
    subtotalBruto, descuentoMonto, totalFinal, subtotalNeto, ivaMonto,
    handleQuickWalkIn, handleProcessStripePayment,
    handleGenerateAltLink, handleCopyLink, handleResetForNextSale,
  }
}
