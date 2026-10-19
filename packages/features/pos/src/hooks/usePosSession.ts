'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import type { Booking, CatalogItem } from '@sportcomplex/core'
import type { TicketComprobanteInput } from '@sportcomplex/printing'
import { calcularDesgloseComprobante } from '../services/receipt'
import { esperarPagoTaquilla } from '../services/esperarPago'

export type ToastKind = 'success' | 'error' | 'info'

/** Nombre de categoría de la BD → clave del catálogo (`Zona Húmeda` → `zona-humeda`). */
export function slugCategoria(nombre: string | undefined): CatalogItem['category'] {
  const slug = (nombre ?? 'canchas')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  return slug as CatalogItem['category']
}

/** `1970-01-01T07:00:00.000Z` (columna TIME serializada) → `07:00`. */
export function horaFranja(valor: string): string {
  return /T(\d{2}:\d{2})/.exec(valor)?.[1] ?? valor.slice(0, 5)
}

/** Primer motivo legible de un rechazo de la API (`fail(..., details)` con `flatten()` de Zod). */
export function motivoRechazo(errJson: unknown, porDefecto: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = (errJson as any)?.error
  const campos = err?.details?.fieldErrors as Record<string, string[] | undefined> | undefined
  const detalle = campos ? Object.values(campos).flat().find(Boolean) : undefined
  return detalle || err?.message || porDefecto
}

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
  // Franja visible (`07:00 - 08:30`) → id de la disponibilidad que se envía al checkout.
  const [slotIds, setSlotIds] = useState<Record<string, string>>({})
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
  // Comprobante del servidor: alimenta la vista previa y la impresión térmica.
  const [receiptComprobante, setReceiptComprobante] = useState<TicketComprobanteInput | null>(null)

  // Modal alternativo
  const [isAltLinkModalOpen, setIsAltLinkModalOpen] = useState<boolean>(false)
  const [altLinkUrl, setAltLinkUrl] = useState<string>('')
  const [altLinkQrUrl, setAltLinkQrUrl] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<boolean>(false)
  // Venta cobrada por QR que espera la confirmación (webhook de Stripe) para imprimir.
  const [awaitingPayment, setAwaitingPayment] = useState<{ reservaId: string; booking: Booking } | null>(null)

  /** Claves de prueba de Stripe (sin cobros reales): el QR muestra la tarjeta de prueba para la demo. */
  const isStripeTestMode = Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_'))

  // Servicios activos desde el catálogo público: `/api/admin/*` es solo de
  // Administrador en el proxy, así que el vendedor recibía 403 y un POS vacío.
  useEffect(() => {
    let active = true
    async function loadServices() {
      try {
        const res = await fetch('/api/public/catalogo')
        if (!res.ok) throw new Error('Error al consultar servicios')
        const json = await res.json()
        if (json.success && Array.isArray(json.data?.servicios) && active) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const items: CatalogItem[] = json.data.servicios.map((s: any) => ({
            id: String(s.id),
            name: s.nombre,
            category: slugCategoria(s.categoria?.nombre),
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
            const ids: Record<string, string> = {}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const backendSlots = json.data.map((item: any) => {
              const label = `${horaFranja(item.franja.horaInicio)} - ${horaFranja(item.franja.horaFin)}`
              ids[label] = String(item.id)
              return label
            })
            setSlotIds(ids)
            setAvailableSlots(backendSlots)
            const firstSlot = backendSlots[0]
            if (firstSlot && !backendSlots.includes(selectedSlot)) {
              setSelectedSlot(firstSlot)
            }
            return
          }
        }
        if (active) {
          setAvailableSlots([])
          setSlotIds({})
          setSelectedSlot('')
        }
      } catch {
        if (active) {
          setAvailableSlots([])
          setSlotIds({})
          setSelectedSlot('')
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

  const handleGenerateAltLink = async () => {
    if (!currentService) return
    if (!clientName.trim() || !clientDoc.trim() || !clientEmail.trim()) {
      notify('Ingresa el nombre, documento y correo del cliente.', 'error')
      return
    }
    if (!selectedSlot || !slotIds[selectedSlot]) {
      notify('No hay una franja disponible seleccionada para esa fecha.', 'error')
      return
    }

    setIsProcessing(true)
    setProcessStep('Generando el QR de pago...')
    try {
      const payload = {
        serviceId: Number(currentService.id) || 1,
        disponibilidadId: slotIds[selectedSlot],
        date: selectedDate,
        slotTime: selectedSlot,
        cantidadCupos: currentService.category === 'canchas' ? 1 : attendees,
        clienteNombre: clientName.trim(),
        clienteDocumento: clientDoc.trim(),
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
      const json = await res.json().catch(() => null)
      const backendBooking = json?.data?.booking
      const link: string | undefined = json?.data?.alternativePaymentUrl || backendBooking?.alternativePaymentUrl
      if (!res.ok || !backendBooking?.id || !link) {
        throw new Error(motivoRechazo(json, 'No se pudo generar el cobro con QR.'))
      }

      setAltLinkUrl(link)
      setAltLinkQrUrl(await QRCode.toDataURL(link, { width: 320, margin: 2 }))
      setIsAltLinkModalOpen(true)
      setAwaitingPayment({
        reservaId: backendBooking.id,
        booking: {
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
          status: 'Pendiente',
          paymentMethod: 'card',
          paymentStatus: 'Pendiente',
          transactionRef: backendBooking.stripeCheckoutSessionId || backendBooking.id,
        },
      })
    } catch (err) {
      console.error('Error al generar el cobro con QR:', err)
      notify(err instanceof Error ? err.message : 'No se pudo generar el cobro con QR.', 'error')
    } finally {
      setIsProcessing(false)
      setProcessStep('')
    }
  }

  // Cobro con QR: cuando el webhook de Stripe confirma, se cierra el QR y se
  // abre el voucher con la vista previa del ticket listo para imprimir.
  useEffect(() => {
    if (!awaitingPayment) return
    const ctrl = new AbortController()
    esperarPagoTaquilla(awaitingPayment.reservaId, { signal: ctrl.signal })
      .then((comprobante) => {
        setReceiptComprobante(comprobante)
        setReceiptQrUrl((comprobante.qr as { dataUrl?: string } | null)?.dataUrl ?? null)
        setConfirmedBooking({ ...awaitingPayment.booking, status: 'Confirmada', paymentStatus: 'Aprobada' })
        setIsAltLinkModalOpen(false)
        setAwaitingPayment(null)
        notify('¡Pago recibido! Reserva confirmada y pase emitido.', 'success')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setAwaitingPayment(null)
        notify(e instanceof Error ? e.message : 'No se pudo confirmar el pago.', 'error')
      })
    return () => ctrl.abort()
  }, [awaitingPayment, notify])

  /** Cerrar el QR deja de esperar el pago (la reserva expira sola si no se paga). */
  const handleCloseAltLink = () => {
    setIsAltLinkModalOpen(false)
    setAwaitingPayment(null)
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
    setReceiptComprobante(null)
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
    confirmedBooking, receiptQrUrl, receiptComprobante,
    isAltLinkModalOpen, setIsAltLinkModalOpen, handleCloseAltLink,
    isAwaitingPayment: awaitingPayment !== null, isStripeTestMode,
    altLinkUrl, altLinkQrUrl, copiedLink,
    filteredServices, currentService,
    subtotalBruto, descuentoMonto, totalFinal, subtotalNeto, ivaMonto,
    handleQuickWalkIn,
    handleGenerateAltLink, handleCopyLink, handleResetForNextSale,
  }
}
