'use client'

import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Clock3,
  CreditCard, Loader2, Lock, QrCode, ShieldCheck, Store,
} from 'lucide-react'
import {
  calculateBookingPrice, categoryBySlug, formatDate, formatMoney,
  type Booking, type PaymentMethod,
} from '@sportcomplex/core'
import { Badge, Input } from '@sportcomplex/ui'
import { ActionButton } from '@/components/action-button'
import { categoryIcons } from '@/components/category-icons'
import { useApp } from '@/components/app-provider'
import { useBookings, useCatalog, useDraft, useLastCode } from '@/lib/stores'

const pseBanks = [
  'Bancolombia',
  'Banco de Bogotá',
  'Davivienda',
  'Nequi',
  'BBVA Colombia',
  'Banco de Occidente',
  'Scotiabank Colpatria',
  'Banco Popular',
  'Banco AV Villas',
  'Lulo Bank',
]

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { session, notify } = useApp()
  const [catalog] = useCatalog()
  const [bookings, setBookings] = useBookings()
  const [draft, setDraft] = useDraft()
  const [, setLastCode] = useLastCode()

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

  // Payment states
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStep, setProcessStep] = useState(1)

  // PSE form state
  const [pseBank, setPseBank] = useState(pseBanks[0])
  const [psePersonType, setPsePersonType] = useState('natural')
  const [pseDocType, setPseDocType] = useState('CC')
  const [pseDocNumber, setPseDocNumber] = useState('')
  const [pseEmail, setPseEmail] = useState(session?.email ?? '')

  // Wompi / Nequi state
  const [nequiPhone, setNequiPhone] = useState('')

  const item = activeDraft ? catalog.find((entry) => entry.id === activeDraft.itemId) : undefined
  const category = item ? categoryBySlug(item.category) : undefined

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

  const confirmPayment = async () => {
    // Form validation based on method
    if (method === 'pse') {
      if (!pseDocNumber.trim()) {
        notify('Ingresa tu número de documento para PSE.', 'error')
        return
      }
      if (!pseEmail.trim() || !pseEmail.includes('@')) {
        notify('Ingresa el correo electrónico registrado en PSE.', 'error')
        return
      }
    } else if (method === 'wompi') {
      if (!nequiPhone.trim() || nequiPhone.replace(/\D/g, '').length < 10) {
        notify('Ingresa un número de celular de 10 dígitos para Nequi.', 'error')
        return
      }
    }

    const clash = bookings.some(
      (booking) =>
        booking.service === item.name &&
        booking.date === activeDraft.date &&
        booking.time === activeDraft.time &&
        booking.status !== 'Cancelada'
    )
    if (clash) {
      notify('Ese horario acaba de ser reservado. Elige otro.', 'error')
      router.push(`/services/${item.category}/${item.id}`)
      return
    }

    // Cobro seguro con tarjeta vía Stripe Checkout (PCI-DSS SAQ A / ARCH-03)
    if (method === 'card') {
      setIsProcessing(true)
      try {
        const lockRes = await fetch('/api/bookings/lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serviceId: Number(item.id) || 1,
            date: activeDraft.date,
            slotTime: activeDraft.time,
            cantidadCupos: isCourt ? 1 : activeDraft.attendees,
            canal: 'ONLINE',
          }),
        })

        if (lockRes.ok) {
          const lockJson = await lockRes.json()
          if (lockJson.success && lockJson.data?.checkout?.url) {
            window.location.href = lockJson.data.checkout.url
            return
          }
        }
        const errJson = await lockRes.json().catch(() => null)
        throw new Error(errJson?.error?.message || 'Error al iniciar la sesión de pago con Stripe.')
      } catch (err: unknown) {
        setIsProcessing(false)
        const msg = err instanceof Error ? err.message : 'No se pudo conectar con la pasarela de pagos.'
        notify(msg, 'error')
      }
    }

    setIsProcessing(true)
    setProcessStep(1)

    // Simulated financial authorization pipeline
    setTimeout(() => {
      setProcessStep(2)
    }, 700)

    setTimeout(() => {
      setProcessStep(3)
    }, 1400)

    setTimeout(() => {
      const [, month, day] = activeDraft.date.split('-')
      const txRef = `WMP-ALT-${Math.floor(100000 + Math.random() * 900000)}`
      const booking: Booking = {
        id: `b${Date.now()}`,
        code: `ALT-${day}${month}-${Math.floor(1000 + Math.random() * 9000)}`,
        client: session?.name ?? 'Cliente',
        category: item.category,
        service: item.name,
        sede: item.sede,
        date: activeDraft.date,
        time: activeDraft.time,
        attendees: activeDraft.attendees,
        amount: total,
        status: 'Confirmada',
        paymentMethod: method,
        paymentStatus: 'Aprobada',
        transactionRef: txRef,
      }
      setBookings([booking, ...bookings])
      setLastCode(booking.code)
      setDraft(null)
      setIsProcessing(false)
      notify('¡Pago aprobado y reserva confirmada!', 'success')
      router.push('/confirmation')
    }, 2100)
  }

  return (
    <main className="section-shell payment-page">
      <Link href={`/services/${item.category}/${item.id}`} className="back-link">
        <ArrowLeft size={15} /> Volver a la reserva
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

      <div className="payment-layout">
        <section className="payment-form">
          <div className="eyebrow">PASARELA DE PAGO SEGURA</div>
          <h1>
            Elige tu medio de <span>pago.</span>
          </h1>
          <p>Transacciones cifradas de extremo a extremo mediante pasarela segura Wompi / Bancolombia.</p>

          {/* Selector de métodos de pago */}
          <div className="payment-methods-tabs">
            <button
              type="button"
              className={`payment-tab-btn ${method === 'card' ? 'active' : ''}`}
              onClick={() => setMethod('card')}
            >
              <CreditCard size={20} />
              <span>Tarjeta</span>
            </button>
            <button
              type="button"
              className={`payment-tab-btn ${method === 'pse' ? 'active' : ''}`}
              onClick={() => setMethod('pse')}
            >
              <Building2 size={20} />
              <span>PSE / Banco</span>
            </button>
            <button
              type="button"
              className={`payment-tab-btn ${method === 'wompi' ? 'active' : ''}`}
              onClick={() => setMethod('wompi')}
            >
              <QrCode size={20} />
              <span>Nequi / QR</span>
            </button>
            <button
              type="button"
              className={`payment-tab-btn ${method === 'on_site' ? 'active' : ''}`}
              onClick={() => setMethod('on_site')}
            >
              <Store size={20} />
              <span>En Sede</span>
            </button>
          </div>

          {/* Formulario según método */}
          {method === 'card' && (
            <div className="payment-method">
              <div className="payment-method-heading">
                <span>Tarjeta de Crédito o Débito</span>
                <div className="card-brands">
                  <b>VISA</b>
                  <b>MC</b>
                  <b>AMEX</b>
                </div>
              </div>

              {/* Pasarela Segura Stripe Checkout (Cumplimiento PCI-DSS SAQ A / SEC-01) */}
              <div className="p-4 rounded-xl border border-[#c9ef75]/40 bg-[#c9ef75]/10 flex flex-col gap-3 my-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={20} className="text-[#123e30] dark:text-[#c9ef75]" />
                  <strong className="text-sm text-[#123e30] dark:text-[#c9ef75]">
                    Pasarela Oficial Stripe Checkout (PCI-DSS SAQ A)
                  </strong>
                </div>
                <p className="text-xs text-[var(--subtle)] leading-relaxed">
                  Por seguridad y estricto cumplimiento del estándar internacional PCI-DSS SAQ A, los datos de tu tarjeta no se capturan ni manipulan en esta aplicación. Al pulsar <strong>Pagar y confirmar reserva</strong>, serás redirigido a la pasarela cifrada de Stripe para completar el pago de forma segura.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink)] pt-2 border-t border-[#c9ef75]/30">
                  <Lock size={12} className="text-[#5e8b48]" />
                  <span>Cifrado bancario de extremo a extremo · Soporta Visa, Mastercard y AMEX</span>
                </div>
              </div>
            </div>
          )}

          {method === 'pse' && (
            <div className="payment-method">
              <div className="payment-method-heading">
                <span>Transferencia Bancaria en Línea (PSE)</span>
                <Badge variant="success">PSE Colombia</Badge>
              </div>
              <p className="text-[12.5px] text-[var(--subtle)]">
                Debes estar registrado en PSE para ser redirigido a la sucursal de tu entidad bancaria.
              </p>

              <label className="demo-field">
                Entidad bancaria
                <select
                  value={pseBank}
                  onChange={(e) => setPseBank(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
                >
                  {pseBanks.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label className="demo-field">
                  Tipo de persona
                  <select
                    value={psePersonType}
                    onChange={(e) => setPsePersonType(e.target.value)}
                    className="min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
                  >
                    <option value="natural">Persona Natural</option>
                    <option value="juridica">Persona Jurídica</option>
                  </select>
                </label>
                <label className="demo-field">
                  Tipo de documento
                  <select
                    value={pseDocType}
                    onChange={(e) => setPseDocType(e.target.value)}
                    className="min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
                  >
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula de Extranjería</option>
                    <option value="NIT">NIT</option>
                    <option value="PAS">Pasaporte</option>
                  </select>
                </label>
              </div>

              <label className="demo-field">
                Número de documento
                <Input
                  value={pseDocNumber}
                  onChange={(e) => setPseDocNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Ej. 1020304050"
                  required
                />
              </label>

              <label className="demo-field">
                Correo electrónico registrado en PSE
                <Input
                  type="email"
                  value={pseEmail}
                  onChange={(e) => setPseEmail(e.target.value)}
                  placeholder="usuario@correo.com"
                  required
                />
              </label>
            </div>
          )}

          {method === 'wompi' && (
            <div className="payment-method">
              <div className="payment-method-heading">
                <span>Nequi / Bancolombia a la Mano</span>
                <Badge variant="success">Instantáneo</Badge>
              </div>
              <p className="text-[12.5px] text-[var(--subtle)]">
                Ingresa tu número de celular asociado a tu cuenta Nequi. Recibirás una notificación push para autorizar el cobro.
              </p>

              <label className="demo-field">
                Número de celular Nequi (10 dígitos)
                <Input
                  type="tel"
                  value={nequiPhone}
                  onChange={(e) => setNequiPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="300 123 4567"
                  required
                />
              </label>

              <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] text-[12px] text-[var(--subtle)] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#557b53] shrink-0" />
                <span>Al confirmar, la solicitud de cobro aparecerá en la bandeja de entrada de tu App Nequi.</span>
              </div>
            </div>
          )}

          {method === 'on_site' && (
            <div className="payment-method">
              <div className="payment-method-heading">
                <span>Pago Presencial en Taquilla</span>
                <Badge variant="secondary">En Complejo</Badge>
              </div>
              <p className="text-[13px] text-[var(--subtle)]">
                Tu reserva quedará registrada y garantizada en el sistema. Podrás pagar en la recepción de la sede con efectivo, tarjeta débito/crédito física o bono corporativo antes de ingresar.
              </p>
              <div className="p-3 rounded-lg border border-[#e3d7a8] bg-[#fdfbf2] dark:border-[#524422] dark:bg-[#2b2413] text-[12.5px] text-[#876e2d] dark:text-[#f2d87e]">
                💡 <b>Importante:</b> Llega con 10 minutos de anticipación para realizar el pago en caja y reclamar tu pulsera de acceso.
              </div>
            </div>
          )}

          {/* Action button */}
          <ActionButton
            onClick={confirmPayment}
            disabled={isProcessing}
            className="w-full justify-center text-[14px]"
          >
            {isProcessing ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Procesando pago...
              </>
            ) : (
              <>
                {method === 'on_site' ? 'Confirmar reserva en sede' : 'Pagar y confirmar reserva'} · {formatMoney(total)}{' '}
                <ArrowRight size={16} />
              </>
            )}
          </ActionButton>

          <Link href="/dashboard" className="demo-payment-link">
            Cancelar y volver a mi cuenta
          </Link>

          <div className="secure-foot">
            <Lock size={14} /> Transacción cifrada con protocolo TLS 256-bit y certificación PCI-DSS
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

      {/* Modal simulador de procesamiento bancario */}
      {isProcessing && (
        <div className="modal-backdrop">
          <div className="reservation-modal payment-processing-modal">
            <div className="processing-spinner" />
            <div className="eyebrow mb-1">PROCESANDO PAGO SEGURO</div>
            <h2 className="text-[20px] font-bold">
              {processStep === 1 && 'Conectando con la entidad financiera...'}
              {processStep === 2 && 'Validando fondos y disponibilidad...'}
              {processStep === 3 && '¡Transacción Aprobada!'}
            </h2>
            <p className="text-[13px] text-[var(--subtle)] mt-2">
              Por favor, no cierres esta ventana mientras confirmamos tu reserva.
            </p>
            <div className="flex gap-2 mt-4">
              <span className={`w-3 h-3 rounded-full ${processStep >= 1 ? 'bg-[#8cd766]' : 'bg-[var(--line)]'}`} />
              <span className={`w-3 h-3 rounded-full ${processStep >= 2 ? 'bg-[#8cd766]' : 'bg-[var(--line)]'}`} />
              <span className={`w-3 h-3 rounded-full ${processStep >= 3 ? 'bg-[#8cd766]' : 'bg-[var(--line)]'}`} />
            </div>
          </div>
        </div>
      )}
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


