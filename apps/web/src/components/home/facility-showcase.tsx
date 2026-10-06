'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock, Flame, Lightbulb, Shield, Sparkles, SunMedium, Trophy } from 'lucide-react'

interface Facility {
  id: string
  title: string
  categorySlug: string
  tabName: string
  subtitle: string
  description: string
  image: string
  priceFrom: string
  unit: string
  statusTag: string
  weatherPill: string
  specs: {
    icon: typeof SunMedium
    label: string
    value: string
  }[]
  perks: string[]
}

const FACILITIES: Facility[] = [
  {
    id: 'padel',
    title: 'Pistas de Pádel Panorámicas',
    categorySlug: 'canchas',
    tabName: 'Pádel Panorámico',
    subtitle: 'Vidrio templado continuo y césped texturizado WPT',
    description: 'Nuestras 4 pistas de pádel panorámicas cuentan con cerramiento de vidrio continuo de 12 mm sin columnas esquineras, garantizando visión periférica total y rebotes acústicamente limpios. Iluminación LED de 800 lux calibrada para juego nocturno sin sombras.',
    image: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$90.000',
    unit: 'hora (4 jugadores)',
    statusTag: 'Pistas disponibles hoy',
    weatherPill: '☀️ 23°C · Cristal Seco',
    specs: [
      { icon: Shield, label: 'Superficie', value: 'Césped Pro WPT 12mm' },
      { icon: Lightbulb, label: 'Iluminación', value: '8 Focos LED 800 Lux' },
      { icon: Clock, label: 'Horario', value: '06:00 AM – 11:00 PM' },
    ],
    perks: ['Alquiler de palas Wilson & Nox', 'Grabación de partidos en video HD', 'Acceso a vestieres y toalla'],
  },
  {
    id: 'tenis',
    title: 'Canchas de Tenis en Polvo de Ladrillo',
    categorySlug: 'canchas',
    tabName: 'Tenis Roland Garros',
    subtitle: 'Tierra batida tratada con drenaje francés subterráneo',
    description: '3 pistas oficiales de arcilla roja mantenidas diariamente con riego automatizado y cepillado profesional. Ofrecen el deslizamiento óptimo para proteger las articulaciones y favorecer los intercambios tácticos de fondo de pista.',
    image: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$75.000',
    unit: 'hora',
    statusTag: 'Humedad controlada',
    weatherPill: '🎾 Arcilla Óptima',
    specs: [
      { icon: Shield, label: 'Superficie', value: 'Polvo de Ladrillo 5 capas' },
      { icon: Trophy, label: 'Norma', value: 'Medidas ITF Oficiales' },
      { icon: Clock, label: 'Horario', value: '06:00 AM – 10:00 PM' },
    ],
    perks: ['Cesta de pelotas presurizadas', 'Servicio de encordado express', 'Marcador electrónico de sets'],
  },
  {
    id: 'futbol',
    title: 'Campo de Fútbol Sintético 8 vs 8',
    categorySlug: 'canchas',
    tabName: 'Fútbol Sintético',
    subtitle: 'Monofilamento de 50mm con relleno de corcho orgánico',
    description: 'Césped sintético certificado FIFA Quality Pro con relleno de ecocorcho termoaislante que reduce la temperatura del campo hasta 8°C bajo el sol de Medellín. Cerramiento perimetral de red elástica y graderías techadas.',
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$160.000',
    unit: 'hora',
    statusTag: 'Reserva activa',
    weatherPill: '⚽ Césped Seco',
    specs: [
      { icon: Shield, label: 'Césped', value: 'Fibrilado FIFA Pro 50mm' },
      { icon: Lightbulb, label: 'Torres LED', value: '1.200 Lux Transmisión' },
      { icon: Clock, label: 'Capacidad', value: 'Hasta 18 personas' },
    ],
    perks: ['Balones oficiales Golty Pro', 'Petos bicolor lavados', 'Hidratación isotónica en banca'],
  },
  {
    id: 'piscina',
    title: 'Piscina Semiolímpica Climatizada',
    categorySlug: 'piscinas',
    tabName: 'Piscina Climatizada',
    subtitle: '25 metros, 6 carriles y filtración salina por electrólisis',
    description: 'Temperatura estable del agua a 28°C todo el año. Sistema ecológico de electrólisis salina que no irrita los ojos ni reseca la piel. Líneas corcheras rompeolas antimovimiento para entrenamiento técnico o nado libre.',
    image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$32.000',
    unit: 'sesión / carril',
    statusTag: 'Agua a 28°C',
    weatherPill: '💧 pH 7.2 Equilibrado',
    specs: [
      { icon: Shield, label: 'Longitud', value: '25m x 6 carriles técnicos' },
      { icon: Flame, label: 'Temperatura', value: '28°C Constante' },
      { icon: Clock, label: 'Profundidad', value: '1.40m a 2.10m progresiva' },
    ],
    perks: ['Tablas, pullbuoys y aletas', 'Cronómetro digital de pared', 'Socorrista profesional permanente'],
  },
  {
    id: 'gimnasio',
    title: 'Centro de Biomecánica & Fuerza',
    categorySlug: 'gimnasio',
    tabName: 'Gimnasio Pro',
    subtitle: 'Maquinaria de poleas convergentes y zona de peso libre Eleiko',
    description: 'Zona de fuerza equipada con barras olímpicas calibradas, plataformas de halterofilia de caucho vulcanizado de 50mm, jaulas de potencia y área de entrenamiento funcional con césped de arrastre de trineo.',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$38.000',
    unit: 'pase de día',
    statusTag: 'Aforo actual 42%',
    weatherPill: '⚡ Aire Climatizado 21°C',
    specs: [
      { icon: Shield, label: 'Equipamiento', value: 'Eleiko & Hammer Strength' },
      { icon: Trophy, label: 'Área', value: '680 m² climatizados' },
      { icon: Clock, label: 'Horario', value: '05:30 AM – 10:30 PM' },
    ],
    perks: ['Zona de movilidad y estiramiento', 'Pesa rusa hasta 40kg', 'Asesoría de entrenadores de sala'],
  },
  {
    id: 'wellness',
    title: 'Circuito de Recuperación & Zona Húmeda',
    categorySlug: 'zona-humeda',
    tabName: 'Zona Wellness',
    subtitle: 'Sauna finlandés de cedro, baño turco aromatizado y crioterapia',
    description: 'La recuperación es parte fundamental del rendimiento deportivo. Nuestro circuito combina sauna seco a 85°C, baño de vapor con eucalipto silvestre, jacuzzis de hidromasaje y pileta de inmersión fría a 10°C para vasoconstricción post-esfuerzo.',
    image: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&q=80',
    priceFrom: '$45.000',
    unit: 'circuito 90 min',
    statusTag: 'Ambiente sereno',
    weatherPill: '🌿 Eucalipto Natural',
    specs: [
      { icon: Flame, label: 'Sauna Seco', value: '85°C Madera de Cedro' },
      { icon: Shield, label: 'Crioterapia', value: 'Pozo de Hielo a 10°C' },
      { icon: Clock, label: 'Duración', value: 'Sesiones de 90 minutos' },
    ],
    perks: ['Toallas calientes e infusión herbal', 'Duchas escocesas de contraste', 'Ambiente silencioso libre de móviles'],
  },
]

export function FacilityShowcase() {
  const [activeId, setActiveId] = useState('padel')
  const facility = FACILITIES.find((f) => f.id === activeId) ?? FACILITIES[0]

  return (
    <section className="section-shell facility-showcase-section">
      <div className="section-header-block">
        <div className="eyebrow">
          <Sparkles size={13} className="text-brand-lime" /> INSTALACIONES DE ALTO RENDIMIENTO
        </div>
        <h2>
          El complejo deportivo, <span>a otro nivel.</span>
        </h2>
        <p className="section-heading-sub">
          Espacios diseñados para deportistas exigentes. Materiales certificados por federaciones
          internacionales y mantenimiento continuo.
        </p>
      </div>

      {/* Selector de Pestañas Flotante */}
      <div className="facility-tabs-wrap" role="tablist" aria-label="Instalaciones deportivas">
        {FACILITIES.map((item) => {
          const isActive = item.id === activeId
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveId(item.id)}
              className={`facility-tab-btn ${isActive ? 'facility-tab-active' : ''}`}
            >
              <span>{item.tabName}</span>
              {isActive && <span className="facility-tab-indicator" />}
            </button>
          )
        })}
      </div>

      {/* Tarjeta de Exhibición Panorámica */}
      <div className="facility-display-card">
        <div className="facility-display-media">
          <Image
            src={facility.image}
            alt={facility.title}
            fill
            sizes="(max-width: 1024px) 100vw, 65vw"
            className="facility-display-img object-cover"
          />
          <div className="facility-media-overlay" />
          <div className="facility-floating-badges">
            <span className="facility-badge-live">
              <span className="live-dot" /> {facility.statusTag}
            </span>
            <span className="facility-badge-weather">{facility.weatherPill}</span>
          </div>
          <div className="facility-media-caption">
            <span className="facility-caption-tag">{facility.tabName}</span>
            <h3>{facility.title}</h3>
          </div>
        </div>

        <div className="facility-display-body">
          <div className="facility-info-header">
            <div>
              <span className="facility-kicker">{facility.subtitle}</span>
              <p className="facility-description">{facility.description}</p>
            </div>
            <div className="facility-price-box">
              <span className="facility-price-label">Tarifa de uso</span>
              <div className="facility-price-val">
                <b>{facility.priceFrom}</b>
                <small>/ {facility.unit}</small>
              </div>
            </div>
          </div>

          {/* Especificaciones Técnicas */}
          <div className="facility-specs-grid">
            {facility.specs.map((spec, i) => {
              const Icon = spec.icon
              return (
                <div key={i} className="facility-spec-item">
                  <div className="facility-spec-icon">
                    <Icon size={17} />
                  </div>
                  <div>
                    <span className="facility-spec-label">{spec.label}</span>
                    <strong className="facility-spec-val">{spec.value}</strong>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ventajas & Botones de Acción */}
          <div className="facility-footer-actions">
            <div className="facility-perks-list">
              {facility.perks.map((perk, i) => (
                <span key={i} className="facility-perk-pill">
                  <CheckCircle2 size={13} className="text-brand-lime" /> {perk}
                </span>
              ))}
            </div>

            <div className="facility-action-group">
              <Link
                href="/portal/book"
                className="action-button"
              >
                Reservar {facility.tabName} <ArrowRight size={16} />
              </Link>
              <Link
                href="/portal/book"
                className="hero-secondary text-sm"
              >
                Ver todos los turnos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
