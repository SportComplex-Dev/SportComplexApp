'use client'

import { useState } from 'react'
import Link from 'next/link'
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

        {/* Toggle Mensual / Anual */}
        <div className="membership-toggle-wrap">
          <button
            type="button"
            className={`membership-toggle-btn ${billingCycle === 'monthly' ? 'toggle-active' : ''}`}
            onClick={() => setBillingCycle('monthly')}
          >
            Facturación Mensual
          </button>
          <button
            type="button"
            className={`membership-toggle-btn ${billingCycle === 'annual' ? 'toggle-active' : ''}`}
            onClick={() => setBillingCycle('annual')}
          >
            Plan Anual <span className="annual-save-pill">-20% AHORRO</span>
          </button>
        </div>
      </div>

      <div className="memberships-grid">
        {PLANS.map((plan) => {
          const isAnnual = billingCycle === 'annual'
          const displayPrice = isAnnual && plan.id !== 'dropin'
            ? plan.id === 'active' ? '$151.200' : '$256.000'
            : plan.price

          return (
            <div
              key={plan.id}
              className={`membership-card ${plan.popular ? 'membership-card-popular' : ''}`}
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
                  href="/portal/membership"
                  className={plan.popular ? 'action-button w-full justify-center' : 'membership-outline-btn'}
                >
                  {plan.ctaText} <ArrowRight size={16} />
                </Link>
                <small className="membership-guarantee">Cancela o pausa cuando quieras sin penalidad</small>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
