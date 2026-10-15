'use client'

import { Suspense, useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Clock3,
  Lock, ShieldCheck, AlertCircle, Loader2,
} from 'lucide-react'
import {
  calculateBookingPrice, categoryBySlug, formatDate, formatMoney,
} from '@sportcomplex/core'
import {
  CheckoutTimer,
  isPaymentBlocked,
  calculateRemainingSeconds,
  usePublicCatalog,
  PaymentMethodSelector,
  pollPaymentConfirmation,
  resolvePaymentOutcome,
} from '@sportcomplex/features-booking'
import { categoryIcons } from '@/components/brand/category-icons'
import { useApp } from '@/components/layout/app-provider'
import { useDraft, useLastCode } from '@sportcomplex/shared/lib'
import { fetchReceiptData, fetchCustomerBookingHistory } from '@sportcomplex/features-portal'

function parseSlotInterval(dateStr: string, timeStr: string): { startTime: string; endTime: string } | null {
  try {
    const raw = timeStr.toLowerCase().replace(/—/g, '-').trim()
    const parts = raw.split('-')

    const parseTo24 = (t: string): { hour: number; minute: number } => {
      const isPm = t.includes('p') || t.includes('pm')
      const isAm = t.includes('a') || t.includes('am')
      const digits = t.replace(/[^0-9:]/g, '').trim()
      const [hStr, mStr] = digits.split(':')
      let h = parseInt(hStr, 10)
      const m = mStr ? parseInt(mStr, 10) : 0
      if (isNaN(h)) h = 8

      if (isPm && h < 12) h += 12
      if (isAm && h === 12) h = 0
      return { hour: h, minute: isNaN(m) ? 0 : m }
    }

    const start = parseTo24(parts[0])
    let end = parts[1] ? parseTo24(parts[1]) : { hour: (start.hour + 1) % 24, minute: start.minute }

    if (end.hour < start.hour || (end.hour === start.hour && end.minute <= start.minute)) {
      end = { hour: Math.min(23, start.hour + 1), minute: start.minute }
    }

    const pad = (n: number) => String(n).padStart(2, '0')
    const startIso = `${dateStr}T${pad(start.hour)}:${pad(start.minute)}:00.000-05:00`
    const endIso = `${dateStr}T${pad(end.hour)}:${pad(end.minute)}:00.000-05:00`

    return {
      startTime: new Date(startIso).toISOString(),
      endTime: new Date(endIso).toISOString(),
    }
  } catch {
    return null
  }
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryReservationId =
    searchParams.get('reservationId') ||
    searchParams.get('reservaId') ||
    searchParams.get('bookingId')

  const { session, notify } = useApp()
  const { catalog } = usePublicCatalog()
  const [draft, setDraft] = useDraft()
  const [, setLastCode] = useLastCode()

  const [reservationId, setReservationId] = useState<string | null>(queryReservationId)
  const [isCreatingReservation, setIsCreatingReservation] = useState(false)
  const [holdError, setHoldError] = useState<string | null>(null)
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState(false)

  // Soporte para enlace alternativo / contingencia de taquilla (SRS §11.1 Riesgo 2)
  const sessionId = searchParams.get('session_id') || searchParams.get('reservaId')
  const paramServiceId = searchParams.get('serviceId')
  const paramServiceName = searchParams.get('service')
  const paramDate = searchParams.get('date')
  const paramTime = searchParams.get('time')
  const paramAttendees = searchParams.get('attendees')

  const paramItem = paramServiceId
    ? catalog.find((entry) => String(entry.id) === String(paramServiceId))
    : paramServiceName
      ? catalog.find((entry) => entry.name.toLowerCase().includes(paramServiceName.toLowerCase()))
      : sessionId ? catalog[0] : undefined

  useEffect(() => {
    if (!draft && paramItem) {
      setDraft({
        itemId: paramItem.id,
        date: paramDate || new Date().toISOString().split('T')[0],
        time: paramTime || '08:00 a. m. - 09:00 a. m.',
        attendees: paramAttendees ? Math.max(1, parseInt(paramAttendees, 10)) : 1,
      })
    }
  }, [draft, paramItem, paramDate, paramTime, paramAttendees, setDraft])

  const activeDraft = draft || (paramItem ? {
    itemId: paramItem.id,
    date: paramDate || new Date().toISOString().split('T')[0],
    time: paramTime || '08:00 a. m. - 09:00 a. m.',
    attendees: paramAttendees ? Math.max(1, parseInt(paramAttendees, 10)) : 1,
  } : null)

  // Timer & Cupo state (TSK-FE-09 / SCRUM-117)
  const [isExpired, setIsExpired] = useState(false)

  // Sincronizar o inicializar el TTL de 30 minutos (1800 seg) del cupo
  useEffect(() => {
    if (!activeDraft) return

    if (!activeDraft.expiresAt) {
      const expiresAt = Date.now() + 30 * 60 * 1000
      setDraft({ ...activeDraft, expiresAt })
    } else if (activeDraft.expiresAt <= Date.now()) {
      setIsExpired(true)
    }
  }, [activeDraft, setDraft])

  const item = activeDraft ? catalog.find((entry) => entry.id === activeDraft.itemId) : undefined
  const category = item ? categoryBySlug(item.category) : undefined

  const creatingRef = useRef(false)

  // Sincronizar o crear la reserva hold en backend si no se cuenta con reservationId
  useEffect(() => {
    if (reservationId || holdError || creatingRef.current) return
    const currentDraft = activeDraft
    const currentItem = item
    if (!currentDraft || !currentItem) return

    let cancelled = false
    async function createHold() {
      if (!currentDraft || !currentItem || creatingRef.current) return
      creatingRef.current = true
      setIsCreatingReservation(true)
      setHoldError(null)

      const interval = parseSlotInterval(currentDraft.date, currentDraft.time)
      if (!interval) {
        setHoldError('El horario seleccionado tiene un formato inválido. Por favor selecciona otro turno.')
        setIsCreatingReservation(false)
        creatingRef.current = false
        return
      }

      try {
        const serviceId = Number(currentItem.id)
        if (isNaN(serviceId) || serviceId <= 0) {
          setHoldError('No se pudo identificar el servicio en el catálogo. Por favor selecciona otro servicio.')
          setIsCreatingReservation(false)
          creatingRef.current = false
          return
        }

        // Intentar registrar la reserva en la DB mediante /api/bookings con horas reales
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId,
            startTime: interval.startTime,
            endTime: interval.endTime,
            cantidadCupos: currentDraft.attendees,
          }),
        })

        const data = await res.json()
        if (cancelled) return

        if (res.ok && data?.data?.id) {
          setReservationId(data.data.id)
        } else {
          const errMsg = data?.error?.message || 'No se pudo reservar el cupo temporal en el horario seleccionado. Puede que ya no haya disponibilidad o la franja no sea válida.'
          setHoldError(errMsg)
          setReservationId(null)
          creatingRef.current = false
        }
      } catch {
        if (!cancelled) {
          setHoldError('Error de conexión al intentar bloquear la disponibilidad. Por favor vuelve a seleccionar el horario.')
          setReservationId(null)
          creatingRef.current = false
        }
      } finally {
        if (!cancelled) {
          setIsCreatingReservation(false)
        }
      }
    }

    void createHold()
    return () => {
      cancelled = true
    }
  }, [activeDraft, item, reservationId, holdError])

  const handleExpire = useCallback(() => {
    setIsExpired(true)
    notify('El tiempo de reserva de 30 minutos ha finalizado. El cupo ha sido liberado.', 'error')
  }, [notify])

  const handleRetry = useCallback(() => {
    setDraft(null)
    setHoldError(null)
    setReservationId(null)
    if (item) {
      router.push(`/services/${item.category}/${item.id}`)
    } else {
      router.push('/services')
    }
  }, [item, router, setDraft])

  if (!activeDraft || !item || !category) {
    return (
      <main className="section-shell payment-page">
        <div className="dashboard-empty">
          <div>
            <b>No tienes una reserva en curso</b>
            <p>Elige un espacio y un horario para continuar.</p>
          </div>
          <Link href="/services">
            Ver servicios <ArrowRight size={15} />
          </Link>
        </div>
      </main>
    )
  }

  const isCourt = item.category === 'canchas'
  const total = calculateBookingPrice(item, activeDraft.attendees)
  const Icon = categoryIcons[category.icon]

  const remainingSeconds = calculateRemainingSeconds(activeDraft?.expiresAt, Date.now())
  const paymentBlocked = isExpired || isPaymentBlocked(remainingSeconds)

  const handlePaymentSuccess = async () => {
    setIsConfirmingPayment(true)
    const targetId = reservationId

    const verification = await pollPaymentConfirmation({
      reservationId: targetId,
      userName: session?.name ?? 'Cliente',
      fetchReceipt: fetchReceiptData,
      fetchHistory: fetchCustomerBookingHistory,
    })

    resolvePaymentOutcome({
      verification,
      onConfirmed: (officialCode) => {
        setLastCode(officialCode)
        setDraft(null)
        setIsConfirmingPayment(false)
        notify('¡Pago confirmado por el servidor y comprobante emitido!', 'success')
        router.push('/confirmation')
      },
      onPending: () => {
        // Si el sondeo vence sin confirmación del backend:
        // Mantenemos el estado "pago recibido, confirmación pendiente"
        // NO generamos código local ALT-* ni comprobante ficticio.
        setIsConfirmingPayment(false)
        setPendingConfirmation(true)
        notify('Pago recibido. La confirmación oficial del servidor está en proceso. Podrás verla en tu portal.', 'info')
      },
    })
  }

  return (
    <main className="section-shell payment-page">
      <Link href={`/services/${item.category}/${item.id}`} className="back-link">
        <ArrowLeft size={15} /> Volver a la selección
      </Link>

      <div className="checkout-progress">
        <span className="progress-step done">
          <Check size={13} /> Espacio
        </span>
        <i />
        <span className="progress-step active">2&nbsp; Pago</span>
        <i />
        <span className="progress-step">3&nbsp; Confirmación</span>
      </div>

      {/* Temporizador regresivo visible en todo momento (TSK-FE-09 / SCRUM-117) */}
      <CheckoutTimer
        expiresAt={activeDraft?.expiresAt}
        initialSeconds={1800}
        onExpire={handleExpire}
        onRetry={handleRetry}
        isExpired={paymentBlocked}
        className="mb-8 max-w-[960px] mx-auto"
      />

      <div className="payment-layout">
        <section className="payment-form">
          <div className="eyebrow">PASARELA DE PAGO SEGURA</div>
          <h1>
            Elige tu medio de <span>pago.</span>
          </h1>
          <p>
            Transacciones 100% cashless y cifradas de extremo a extremo mediante pasarela segura Stripe.
          </p>

          {pendingConfirmation ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-8 text-center text-sm">
              <AlertCircle className="mx-auto size-8 text-amber-600 mb-3" />
              <p className="font-bold text-ink text-base">Pago recibido · Confirmación pendiente</p>
              <p className="mt-2 text-xs text-subtle max-w-md mx-auto">
                Hemos recibido tu pago en la pasarela. La confirmación oficial y emisión del tiquete están siendo procesadas por el servidor.
              </p>
              <p className="mt-1 text-xs text-subtle max-w-md mx-auto">
                Puedes consultar el estado definitivo de tu reserva y descargar tu comprobante una vez emitido desde tu portal.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link
                  href="/portal"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition"
                >
                  Ir a Mi Portal <ArrowRight size={14} />
                </Link>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-ink text-xs font-medium hover:bg-[var(--surface-soft)] transition"
                >
                  Ver más servicios
                </Link>
              </div>
            </div>
          ) : isConfirmingPayment ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-center text-sm">
              <Loader2 className="mx-auto size-8 animate-spin text-emerald-600 mb-3" />
              <p className="font-bold text-ink text-base">Pago en proceso</p>
              <p className="mt-1 text-xs text-subtle max-w-sm mx-auto">
                Estamos validando la confirmación de tu pago con el servidor y emitiendo tu tiquete oficial…
              </p>
            </div>
          ) : holdError ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-center">
              <AlertCircle className="mx-auto size-7 text-destructive mb-2" />
              <p className="font-bold text-destructive text-base">No se pudo reservar el horario</p>
              <p className="mt-1 text-xs text-subtle max-w-md mx-auto">{holdError}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-white text-xs font-semibold hover:opacity-90 transition"
              >
                Volver a seleccionar horario <ArrowRight size={14} />
              </button>
            </div>
          ) : isCreatingReservation ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] p-6 text-center text-sm">
              <p className="font-semibold text-ink">Iniciando sesión segura de pago…</p>
              <p className="mt-1 text-xs text-subtle">
                Estamos preparando el bloqueo temporal de tu horario en el sistema.
              </p>
            </div>
          ) : (
            <PaymentMethodSelector
              reservationId={reservationId}
              onPaymentSuccess={handlePaymentSuccess}
            />
          )}

          <div className="mt-6 flex items-start gap-2 text-xs leading-5 text-subtle">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#527c47]" />
            <p>
              Tu pago se procesa con Stripe Elements. La reserva se confirma de forma atómica
              y se genera el tiquete digital de acceso al club.
            </p>
          </div>

          <div className="secure-foot mt-6">
            <Lock size={14} /> Transacción cifrada con protocolo TLS 256-bit y certificación PCI-DSS Nivel 1
          </div>
        </section>

        {/* Aside: Purchase summary */}
        <aside className="order-card">
          <div className="eyebrow">RESUMEN DE COMPRA</div>
          <h3>Tu reserva</h3>
          <div className="order-service">
            <div className="order-service-thumb">
              <Icon size={23} />
            </div>
            <div>
              <b>{item.name}</b>
              <span>
                Sede {item.sede}
                {!isCourt && <> · {activeDraft.attendees} {activeDraft.attendees === 1 ? 'asistente' : 'asistentes'}</>}
              </span>
            </div>
          </div>
          <div className="order-item">
            <span>
              <CalendarDays size={15} /> {formatDate(activeDraft.date)}
            </span>
            <span>
              <Clock3 size={15} /> {activeDraft.time} · 60 minutos
            </span>
          </div>
          <div className="order-item py-2 border-b border-[var(--line)] flex items-center justify-between text-[12px]">
            <span>Estado de cupo</span>
            <b className={paymentBlocked ? 'text-red-500 font-bold' : 'text-[#4b7652] dark:text-[#9ee285] font-bold'}>
              {paymentBlocked ? 'Expirado' : 'Bloqueado (30 min)'}
            </b>
          </div>
          <div className="order-price">
            <span>{isCourt ? 'Tarifa fija' : `${formatMoney(item.price)} × ${activeDraft.attendees}`}</span>
            <b>{formatMoney(total)}</b>
          </div>
          <div className="order-total">
            <span>Total a pagar</span>
            <b>
              {formatMoney(total)} <small>COP</small>
            </b>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--line)] text-[11.5px] text-[var(--subtle)] flex items-center justify-between">
            <span>IVA incluido (19%)</span>
            <span>{formatMoney(Math.round((total * 19) / 119))} COP</span>
          </div>
        </aside>
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <main className="section-shell payment-page">
          <div className="dashboard-empty">
            <b>Cargando pasarela de pago...</b>
            <p>Por favor espera un momento.</p>
          </div>
        </main>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
