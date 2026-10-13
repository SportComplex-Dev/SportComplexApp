'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Crown,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { formatDate } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { useApp } from '@/components/app-provider'
import {
  calcularDesglosePlan,
  iniciarSuscripcionStripe,
  type MembresiaActivaDTO,
  type PlanDisplayBreakdown,
  type PlanMembresiaDTO,
} from '@/components/portal/membership-utils'

export default function MembershipPortalPage() {
  const { notify } = useApp()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [planes, setPlanes] = useState<PlanDisplayBreakdown[]>([])
  const [membresiaActiva, setMembresiaActiva] = useState<MembresiaActivaDTO | null>(null)
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<PlanDisplayBreakdown | null>(null)
  const [subscribingPlanId, setSubscribingPlanId] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isSuccessUrl = searchParams.get('success') === 'true'
  const isCancelledUrl = searchParams.get('cancelled') === 'true'

  // Cargar catálogo de planes y membresía del usuario desde GET /api/memberships
  const fetchMembershipData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/memberships', {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      const data = await res.json()
      if (data.success && data.data) {
        const rawPlanes: PlanMembresiaDTO[] = data.data.planes || []
        const active: MembresiaActivaDTO | null = data.data.membresiaActiva || null
        setMembresiaActiva(active)

        const breakdowns = rawPlanes.map((p) => calcularDesglosePlan(p, active?.estado === 'VIGENTE'))
        setPlanes(breakdowns)
      } else {
        setErrorMsg(data.error?.message || 'Error al obtener los planes de membresía.')
      }
    } catch {
      setErrorMsg('No se pudo conectar con el servicio de membresías.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembershipData()
  }, [])

  // Notificar al usuario tras retornar de Stripe Checkout
  useEffect(() => {
    if (isSuccessUrl) {
      notify('¡Suscripción procesada con éxito! Bienvenido al club exclusivo con 30% de descuento.', 'success')
    } else if (isCancelledUrl) {
      notify('Proceso de pago en Stripe cancelado. Puedes retomar la suscripción cuando desees.', 'info')
    }
  }, [isSuccessUrl, isCancelledUrl, notify])

  // Iniciar el flujo de checkout recurrente en Stripe
  const handleSubscribe = async (plan: PlanDisplayBreakdown) => {
    if (membresiaActiva?.estado === 'VIGENTE') {
      notify('Ya posees una membresía VIGENTE en el club.', 'info')
      return
    }

    setSubscribingPlanId(plan.id)
    const result = await iniciarSuscripcionStripe(plan.id)

    if (result.success && result.url) {
      // Redirigir a Stripe Checkout
      window.location.href = result.url
    } else {
      setSubscribingPlanId(null)
      if (result.errorCode === 'DUPLICATE_ACTIVE_MEMBERSHIP') {
        notify('Ya cuentas con una membresía activa vigente.', 'error')
        fetchMembershipData()
      } else if (result.errorCode === 'STRIPE_PRICE_NOT_CONFIGURED') {
        notify('Este plan está en proceso de configuración en Stripe.', 'error')
      } else {
        notify(result.errorMessage || 'No se pudo iniciar el checkout en Stripe.', 'error')
      }
    }
  }

  const isVigente = membresiaActiva?.estado === 'VIGENTE'

  return (
    <>
      <main className="section-shell app-page no-print pb-16">
        {/* Encabezado del Portal de Membresías */}
        <div className="welcome-row mb-8">
          <div>
            <div className="eyebrow flex items-center gap-2">
              <Crown size={14} className="text-[#c9ef75]" />
              <span>MEMBRESÍAS Y BENEFICIOS EXCLUSIVOS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 mb-2">
              Membresías con <span className="text-[#c9ef75]">30 % de Descuento</span> Permanente
            </h1>
            <p className="text-[var(--subtle)] text-sm max-w-2xl leading-relaxed">
              Disfruta de la mejor experiencia deportiva con tarifas preferenciales en todas tus reservas
              de canchas, pistas y acceso total al complejo deportivo. Precios transparentes y sin sorpresas antes de pagar.
            </p>
          </div>
        </div>

        {/* Banner de retorno de Stripe */}
        {isSuccessUrl && (
          <div className="mb-8 p-4 rounded-xl border border-[#276749] bg-[#0c2e1f] text-[#c9ef75] flex items-center gap-3 animate-in fade-in">
            <CheckCircle2 size={24} className="shrink-0" />
            <div>
              <b className="block text-sm">¡Tu suscripción está confirmada y activa!</b>
              <p className="text-xs text-[#a3e635] mt-0.5">
                El descuento del 30 % se aplicará de manera automática en todas tus reservas de canchas y servicios.
              </p>
            </div>
          </div>
        )}

        {/* Estado de Suscripción Vigente (Si el usuario ya tiene una) */}
        {isVigente && membresiaActiva && (
          <section className="mb-12" aria-label="Estado de suscripción actual">
            <div className="p-6 sm:p-7 rounded-2xl border-2 border-[#c9ef75] bg-gradient-to-r from-[#091b13] via-[#0d2a1d] to-[#123e30] text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Crown size={160} />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <Badge variant="success" className="text-xs font-bold px-3 py-1 bg-[#c9ef75] text-[#091b13]">
                      MEMBRESÍA {membresiaActiva.estado}
                    </Badge>
                    <span className="text-xs text-[#c9ef75] font-mono tracking-wider font-semibold">
                      PLAN #{membresiaActiva.plan?.id ?? membresiaActiva.id}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1">
                    {membresiaActiva.plan?.nombre || 'Plan de Membresía Activo'}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#d1fae5] max-w-xl">
                    Cuentas con el beneficio preferencial activo del <strong>30 % de descuento</strong> en
                    cualquier reserva online o presencial en taquilla.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 bg-black/30 p-4 rounded-xl border border-white/10 shrink-0">
                  <div>
                    <span className="text-[11px] text-gray-300 flex items-center gap-1">
                      <Calendar size={12} /> Fecha de Inicio
                    </span>
                    <strong className="block text-xs sm:text-sm font-semibold mt-0.5 text-white">
                      {formatDate(membresiaActiva.fechaInicio)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-[#c9ef75] flex items-center gap-1 font-semibold">
                      <Clock size={12} /> Próxima Renovación
                    </span>
                    <strong className="block text-xs sm:text-sm font-bold mt-0.5 text-[#c9ef75]">
                      {formatDate(membresiaActiva.proximaRenovacion)}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#c9ef75]" />
                  <span>Cobro recurrente automático procesado con seguridad por pasarela certificada.</span>
                </div>
                <Link
                  href="/services"
                  className="inline-flex items-center gap-1.5 font-bold text-[#c9ef75] hover:underline"
                >
                  Aprovechar mi 30% reservando una cancha <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Transparencia total de precios con desglose del 30% antes de pagar */}
        <section aria-label="Planes disponibles y desglose transparente">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={32} className="animate-spin text-[#c9ef75]" />
              <span className="text-sm text-[var(--subtle)]">Cargando planes de membresía disponibles...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-center">
              <ShieldAlert size={32} className="mx-auto mb-2" />
              <p className="text-sm font-semibold">{errorMsg}</p>
              <button
                type="button"
                onClick={fetchMembershipData}
                className="mt-4 calendar-shortcut text-xs py-1.5 px-3 mx-auto gap-1"
              >
                <RefreshCw size={13} /> Reintentar
              </button>
            </div>
          ) : planes.length === 0 ? (
            <div className="demo-card text-center py-12">
              <Sparkles size={36} className="mx-auto text-[var(--subtle)] mb-3 opacity-60" />
              <b className="block text-base">No hay planes activos configurados</b>
              <p className="text-sm text-[var(--subtle)] mt-1 mb-5">
                El complejo deportivo está actualizando las tarifas y periodicidades de membresías.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch max-w-5xl mx-auto">
              {planes.map((plan) => {
                const isCurrent = membresiaActiva?.plan?.id === plan.id && isVigente
                const isSubscribingThis = subscribingPlanId === plan.id

                return (
                  <div
                    key={plan.id}
                    className={`membership-card ${plan.popular ? 'membership-card-popular' : ''} flex flex-col justify-between !p-5`}
                  >
                    {plan.popular && (
                      <div className="membership-popular-badge">
                        <Sparkles size={13} /> MÁS POPULAR
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="membership-kicker">PLAN {plan.periodicidad}</span>
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[#c9ef75] text-[#091b13]">
                          AHORRA 30%
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-[var(--ink)] tracking-tight">{plan.nombre}</h3>

                      <div className="my-4 p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-[var(--ink)] tracking-tight">
                            {plan.precioConDescuentoFormateado}
                          </span>
                          <span className="text-[11px] text-[var(--subtle)]">/ {plan.periodicidadLabel.toLowerCase()}</span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-[var(--line)] flex items-center justify-between text-[11px]">
                          <span className="text-[var(--subtle)]">Tarifa regular:</span>
                          <span className="line-through text-[var(--ink-muted)] font-semibold">
                            {plan.precioOriginalFormateado}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-[#557b53] dark:text-[#c9ef75]">
                          <span>Descuento (30 %):</span>
                          <span>- {plan.montoDescuentoFormateado}</span>
                        </div>
                        {plan.ahorroAnualLabel && (
                          <div className="mt-2 pt-2 text-[10.5px] text-[#1b5e20] dark:text-[#c9ef75] font-semibold border-t border-[var(--line)] flex items-center gap-1.5">
                            <Sparkles size={12} className="shrink-0 text-[#1b5e20] dark:text-[#c9ef75]" />
                            <span>{plan.ahorroAnualLabel}</span>
                          </div>
                        )}
                      </div>

                      <ul className="space-y-1.5 mb-4">
                        {plan.beneficios.slice(0, 3).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11.5px] leading-snug">
                            <Check size={12} strokeWidth={3} className="mt-0.5 text-[#c9ef75] shrink-0" />
                            <span className="text-[var(--subtle)]">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-3 border-t border-[var(--line)]">
                      {isCurrent ? (
                        <div className="p-2 rounded-lg bg-[#c9ef75]/15 border border-[#c9ef75]/30 text-center">
                          <span className="text-xs font-bold text-[#c9ef75] flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={15} /> Tu Plan Vigente Actual
                          </span>
                        </div>
                      ) : isVigente ? (
                        <button
                          type="button"
                          disabled
                          className="calendar-shortcut w-full justify-center text-xs py-2 opacity-60 cursor-not-allowed"
                          title="Para cambiar de plan, debes esperar al término de tu vigencia o cancelarla."
                        >
                          Membresía activa existente
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedPlanForModal(plan)}
                          disabled={isSubscribingThis}
                          className={
                            plan.popular
                              ? 'action-button w-full justify-center text-xs py-2.5 gap-2 font-bold'
                              : 'membership-outline-btn w-full justify-center text-xs py-2 gap-2'
                          }
                        >
                          {isSubscribingThis ? (
                            <>
                              <Loader2 size={14} className="animate-spin" /> Conectando con Stripe...
                            </>
                          ) : (
                            <>
                              <CreditCard size={14} /> Suscribirme <ArrowRight size={13} />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Sección de Beneficios de la Membresía */}
        <section className="mt-16 max-w-2xl mx-auto" aria-label="Información del descuento">
          <div className="demo-card p-6 text-center">
            <div className="inline-flex p-3 rounded-full bg-[#c9ef75]/10 text-[#c9ef75] mb-3">
              <Zap size={22} />
            </div>
            <h3 className="font-bold text-lg mb-2">¿Cómo disfrutas tu 30 % de descuento?</h3>
            <p className="text-xs sm:text-sm text-[var(--subtle)] leading-relaxed">
              Al confirmar tu suscripción, tu membresía quedará inmediatamente activa.
              Cada vez que reserves una cancha, pista deportiva o sesión en piscina, el 30 % de descuento
              se reflejará de forma automática en el resumen de tu compra antes de realizar el pago.
            </p>
          </div>
        </section>
      </main>

      {/* Modal de Confirmación Previo a Stripe Checkout (Criterio Clave: Ver precio con y sin descuento antes de confirmar) */}
      {selectedPlanForModal && (
        <div
          className="qr-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-plan-modal-title"
          onClick={() => setSelectedPlanForModal(null)}
        >
          <div className="qr-modal-dialog max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow text-center text-xs">RESUMEN PREVIO AL COBRO</div>
            <h2 id="confirm-plan-modal-title" className="text-xl font-bold tracking-tight text-center mt-1 mb-1">
              Confirmar Suscripción
            </h2>
            <p className="text-xs text-[var(--subtle)] text-center mb-5">
              Verifica las condiciones de tu plan antes de ser redirigido a la pasarela bancaria.
            </p>

            <div className="p-4 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] space-y-3 mb-5">
              <div className="flex justify-between items-center text-sm border-b border-[var(--line)] pb-2">
                <span className="font-bold text-[var(--ink)]">{selectedPlanForModal.nombre}</span>
                <Badge variant="secondary" className="text-xs">
                  Recurrente {selectedPlanForModal.periodicidad}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-xs text-[var(--subtle)]">
                <span>Precio de lista sin descuento:</span>
                <span className="line-through">{selectedPlanForModal.precioOriginalFormateado}</span>
              </div>

              <div className="flex justify-between items-center text-xs text-[#557b53] dark:text-[#c9ef75] font-semibold">
                <span>Descuento aplicado (30 %):</span>
                <span>- {selectedPlanForModal.montoDescuentoFormateado}</span>
              </div>

              <div className="border-t border-[var(--line)] pt-2.5 flex justify-between items-baseline">
                <div>
                  <span className="text-xs font-bold text-[var(--ink)] block">Total a debitar:</span>
                  <small className="text-[10px] text-[var(--subtle)]">IVA 19% incluido</small>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#557b53] dark:text-[#c9ef75]">
                    {selectedPlanForModal.precioConDescuentoFormateado}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[11px] text-[var(--subtle)] mb-5 flex items-start gap-2">
              <Info size={15} className="text-[#c9ef75] shrink-0 mt-0.5" />
              <span>
                Al continuar serás transferido a la pasarela de pago segura para completar el registro de tu
                tarjeta. El monto a debitar es exactamente el indicado en este resumen.
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                className="calendar-shortcut flex-1 justify-center text-xs py-2.5"
                onClick={() => setSelectedPlanForModal(null)}
              >
                Modificar selección
              </button>
              <button
                type="button"
                className="action-button flex-1 justify-center text-xs py-2.5 font-bold gap-1.5"
                onClick={() => {
                  const plan = selectedPlanForModal
                  setSelectedPlanForModal(null)
                  handleSubscribe(plan)
                }}
              >
                <CreditCard size={14} /> Proceder a Stripe
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
