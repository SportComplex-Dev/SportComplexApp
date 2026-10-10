'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, Check, Clock3,
  CreditCard, Loader2, Lock, QrCode, ShieldCheck, Sparkles, Store,
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

export default function CheckoutPage() {
  const router = useRouter()
  const { session, notify } = useApp()
  const [catalog] = useCatalog()
  const [bookings, setBookings] = useBookings()
  const [draft, setDraft] = useDraft()
  const [, setLastCode] = useLastCode()

  // Payment states
  const [method, setMethod] = useState<PaymentMethod>('card')
  const [isProcessing, setIsProcessing] = useState(false)
  const [processStep, setProcessStep] = useState(1)

  // Card form state
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState(session?.name ?? '')
  const [cardExp, setCardExp] = useState('')
  const [cardCvc, setCardCvc] = useState('')
  const [installments, setInstallments] = useState('1')

  // PSE form state
  const [pseBank, setPseBank] = useState(pseBanks[0])
  const [psePersonType, setPsePersonType] = useState('natural')
  const [pseDocType, setPseDocType] = useState('CC')
  const [pseDocNumber, setPseDocNumber] = useState('')
  const [pseEmail, setPseEmail] = useState(session?.email ?? '')

  // Wompi / Nequi state
  const [nequiPhone, setNequiPhone] = useState('')

  const item = draft ? catalog.find((entry) => entry.id === draft.itemId) : undefined
  const category = item ? categoryBySlug(item.category) : undefined

  if (!draft || !item || !category) {
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
  const total = calculateBookingPrice(item, draft.attendees)
  const Icon = categoryIcons[category.icon]

  // Formaters
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16)
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ')
    setCardNumber(formatted)
  }

  const handleExpChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4)
    if (raw.length > 2) {
      setCardExp(`${raw.slice(0, 2)}/${raw.slice(2)}`)
    } else {
      setCardExp(raw)
    }
  }

  const fillTestCard = () => {
    setCardNumber('4532 8912 3456 8821')
    setCardHolder(session?.name || 'MARÍA CAMILA RESTREPO')
    setCardExp('09/29')
    setCardCvc('821')
    notify('Tarjeta de prueba Visa precargada.', 'success')
  }

  const confirmPayment = async () => {
    // Form validation based on method
    if (method === 'card') {
      if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 15) {
        notify('Ingresa un número de tarjeta válido.', 'error')
        return
      }
      if (!cardExp.trim() || cardExp.length < 5) {
        notify('Ingresa la fecha de vencimiento (MM/AA).', 'error')
        return
      }
      if (!cardCvc.trim() || cardCvc.length < 3) {
        notify('Ingresa el código CVC de 3 dígitos.', 'error')
        return
      }
    } else if (method === 'pse') {
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
        booking.date === draft.date &&
        booking.time === draft.time &&
        booking.status !== 'Cancelada'
    )
    if (clash) {
      notify('Ese horario acaba de ser reservado. Elige otro.', 'error')
      router.push(`/services/${item.category}/${item.id}`)
      return
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
      const [, month, day] = draft.date.split('-')
      const txRef = `WMP-ALT-${Math.floor(100000 + Math.random() * 900000)}`
      const booking: Booking = {
        id: `b${Date.now()}`,
        code: `ALT-${day}${month}-${Math.floor(1000 + Math.random() * 9000)}`,
        client: session?.name ?? 'Cliente',
        category: item.category,
        service: item.name,
        sede: item.sede,
        date: draft.date,
        time: draft.time,
        attendees: draft.attendees,
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

              {/* Visual Card Preview */}
              <div className="card-visual-preview">
                <div className="flex justify-between items-start">
                  <div className="card-chip" />
                  <span className="text-[12px] font-extrabold tracking-widest text-[#c9ef75]">ALTURA CLUB</span>
                </div>
                <div className="card-preview-number">
                  {cardNumber || '•••• •••• •••• ••••'}
                </div>
                <div className="card-preview-footer">
                  <div>
                    <small className="text-[9px] uppercase tracking-wider block opacity-75">TITULAR</small>
                    <span className="card-preview-name">{cardHolder || 'NOMBRE DEL TITULAR'}</span>
                  </div>
                  <div>
                    <small className="text-[9px] uppercase tracking-wider block opacity-75">VENCE</small>
                    <span className="card-preview-exp">{cardExp || 'MM/AA'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end -mt-2 mb-2">
                <button
                  type="button"
                  onClick={fillTestCard}
                  className="text-[12px] font-semibold text-[#4b7652] dark:text-[#9ee285] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles size={13} /> Cargar datos de tarjeta de prueba
                </button>
              </div>

              <label className="demo-field">
                Número de tarjeta
                <Input
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                  required
                />
              </label>

              <label className="demo-field">
                Nombre del titular (como figura en el plástico)
                <Input
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                  placeholder="JUAN PÉREZ"
                  required
                />
              </label>

              <div className="form-row">
                <label className="demo-field">
                  Vencimiento (MM/AA)
                  <Input
                    value={cardExp}
                    onChange={(e) => handleExpChange(e.target.value)}
                    placeholder="MM/AA"
                    maxLength={5}
                    required
                  />
                </label>
                <label className="demo-field">
                  Código de seguridad (CVC)
                  <Input
                    type="password"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                    required
                  />
                </label>
              </div>

              <label className="demo-field">
                Número de cuotas
                <select
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  className="min-h-[44px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)]"
                >
                  <option value="1">1 cuota (sin intereses)</option>
                  <option value="2">2 cuotas</option>
                  <option value="3">3 cuotas</option>
                  <option value="6">6 cuotas</option>
                  <option value="12">12 cuotas</option>
                </select>
              </label>
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
                {!isCourt && <> · {draft.attendees} {draft.attendees === 1 ? 'asistente' : 'asistentes'}</>}
              </span>
            </div>
          </div>
          <div className="order-item">
            <span>
              <CalendarDays size={15} /> {formatDate(draft.date)}
            </span>
            <span>
              <Clock3 size={15} /> {draft.time} · 60 minutos
            </span>
          </div>
          <div className="order-price">
            <span>{isCourt ? 'Tarifa fija' : `${formatMoney(item.price)} × ${draft.attendees}`}</span>
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

