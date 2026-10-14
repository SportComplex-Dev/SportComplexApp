'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, Sparkles, Zap } from 'lucide-react'

interface PlanTier {
  id: string
  name: string
  kicker: string
  price: string
  period: string
  popular?: boolean
  description: string
  features: string[]
  ctaText: string
  badge?: string
}

const PLANS: PlanTier[] = [
  {
    id: 'dropin',
    name: 'Pase Diario',
    kicker: 'PAGA POR JUGAR',
    price: '$35.000',
    period: 'por sesión',
    description: 'Flexibilidad absoluta para deportistas ocasionales o visitantes en Medellín.',
    features: [
      'Sin cuotas mensuales ni permanencia',
      'Reserva de turnos con hasta 24h de anticipación',
      'Acceso a vestieres, duchas y casilleros de día',
      'Tarifas estándar en alquiler de canchas',
      'Validación rápida por código QR en torniquete',
    ],
    ctaText: 'Comprar pase de día',
  },
  {
    id: 'active',
    name: 'Active Club',
    kicker: 'EL PLAN FAVORITO DE LOS SOCIOS',
    price: '$189.000',
    period: 'mes (sin cláusula)',
    popular: true,
    badge: 'MÁS ELEGIDO',
    description: 'La membresía completa para quienes entrenan con frecuencia y buscan comunidad.',
    features: [
      '30% de descuento automático en todas las reservas (RN-08)',
      'Reserva preferente con 7 días de anticipación',
      'Acceso libre ilimitado a Gimnasio & Piscina',
      '1 pase de invitado de cortesía cada mes',
      'Toalla deportiva limpia en cada visita',
      'Descuento del 10% en cafetería & bar del club',
    ],
    ctaText: 'Unirme a Active Club',
  },
  {
    id: 'black',
    name: 'Black / Pro',
    kicker: 'EXPERIENCIA PRIVADA VIP',
    price: '$320.000',
    period: 'mes',
    description: 'Acceso total y prioritario para atletas de alto rendimiento y ejecutivos.',
    features: [
      'Reserva VIP con ventana máxima de 15 días (RN-01)',
      '30% de descuento en todos los servicios (RN-08)',
      'Casillero privado fijo con cerradura digital',
      'Acceso ilimitado a Circuito Sauna, Turco & Jacuzzi',
      'Inscripción prioritaria a torneos de pádel y tenis',
      '3 pases de invitado de cortesía al mes',
      'Servicio de conserjería deportiva personalizada',
    ],
    ctaText: 'Solicitar membresía Black',
  },
]

export function MembershipsSection() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const shouldReduceMotion = useReducedMotion()

  return (
    <section className="section-shell memberships-section">
      <div className="section-header-block text-center max-w-2xl mx-auto">
        <div className="eyebrow justify-center">
          <Zap size={13} className="text-brand-lime" /> MEMBRESÍAS & PLANES DE ACCESO
        </div>
        <h2>
          Elige cómo vivir la experiencia <span>AKROS.</span>
        </h2>
        <p className="section-heading-sub mx-auto">
          Desde turnos individuales hasta membresías completas con acceso total a gimnasio, piscina,
          zona húmeda y descuento del 30% en pistas (RN-08).
        </p>

        {/* Toggle Mensual / Anual con layoutId deslizante */}
        <div className="membership-toggle-wrap">
          <motion.button
            type="button"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            className={`membership-toggle-btn relative ${billingCycle === 'monthly' ? 'toggle-active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            {billingCycle === 'monthly' && (
              <motion.span
                layoutId="activeBillingCycle"
                className="absolute inset-0 rounded-full bg-[#123e30] border border-[#c9ef75] -z-0 dark:bg-[#1a3828]"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10">Facturación Mensual</span>
          </motion.button>
          <motion.button
            type="button"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
            className={`membership-toggle-btn relative ${billingCycle === 'annual' ? 'toggle-active' : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            {billingCycle === 'annual' && (
              <motion.span
                layoutId="activeBillingCycle"
                className="absolute inset-0 rounded-full bg-[#123e30] border border-[#c9ef75] -z-0 dark:bg-[#1a3828]"
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              Plan Anual <span className="annual-save-pill">-20% AHORRO</span>
            </span>
          </motion.button>
        </div>
      </div>

      <div className="memberships-grid">
        {PLANS.map((plan) => {
          const isAnnual = billingCycle === 'annual'
          const displayPrice = isAnnual && plan.id !== 'dropin'
            ? plan.id === 'active' ? '$151.200' : '$256.000'
            : plan.price

          return (
            <motion.div
              key={plan.id}
              whileHover={shouldReduceMotion ? undefined : { y: -6, transition: { type: 'spring', stiffness: 320, damping: 20 } }}
              className={`membership-card transition-colors ${plan.popular ? 'membership-card-popular' : ''}`}
            >
              {plan.popular && (
                <div className="membership-popular-badge">
                  <Sparkles size={13} /> {plan.badge}
                </div>
              )}

              <div className="membership-card-header">
                <span className="membership-kicker">{plan.kicker}</span>
                <h3 className="membership-title">{plan.name}</h3>
                <p className="membership-desc">{plan.description}</p>
              </div>

              <div className="membership-price-block">
                <div className="membership-price-row">
                  <span className="membership-amount">{displayPrice}</span>
                  <span className="membership-period">/ {isAnnual && plan.id !== 'dropin' ? 'mes (pago anual)' : plan.period}</span>
                </div>
                {isAnnual && plan.id !== 'dropin' && (
                  <span className="membership-saving-note">Ahorras 2 meses pagando el año completo</span>
                )}
              </div>

              <div className="membership-divider" />

              <div className="membership-features-list">
                <span className="membership-features-title">Qué incluye:</span>
                <ul>
                  {plan.features.map((feature, i) => (
                    <li key={i}>
                      <Check size={16} className="text-brand-lime shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="membership-card-cta">
                <Link
                  href={
                    plan.id === 'active'
                      ? `/portal/membership?planId=${billingCycle === 'annual' ? 'ANUAL' : 'MENSUAL'}`
                      : plan.id === 'black'
                      ? `/portal/membership?planId=${billingCycle === 'annual' ? 'ANUAL' : 'MENSUAL'}`
                      : '/portal/membership?planId=SEMANAL'
                  }
                  className={plan.popular ? 'action-button w-full justify-center' : 'membership-outline-btn'}
                >
                  {plan.ctaText} <ArrowRight size={16} />
                </Link>
                <small className="membership-guarantee">Cancela o pausa cuando quieras sin penalidad</small>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
