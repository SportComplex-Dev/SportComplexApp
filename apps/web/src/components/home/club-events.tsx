'use client'

import Link from 'next/link'
import { ArrowRight, Calendar, Clock, MapPin, Trophy, Users } from 'lucide-react'

interface ClubEvent {
  id: string
  title: string
  category: 'Pádel' | 'Tenis' | 'Natación' | 'Wellness'
  tone: 'lime' | 'blue' | 'orange' | 'purple'
  date: string
  time: string
  sede: string
  court: string
  spotsLeft: number
  totalSpots: number
  level: string
  description: string
  tag: string
}

const EVENTS: ClubEvent[] = [
  {
    id: 'padel-night',
    title: 'Torneo Relámpago Nocturno de Pádel',
    category: 'Pádel',
    tone: 'lime',
    date: 'Viernes, 24 Oct',
    time: '7:00 PM - 11:00 PM',
    sede: 'Sede El Poblado',
    court: 'Pistas Panorámicas 1 a 4',
    spotsLeft: 4,
    totalSpots: 16,
    level: 'Segunda & Tercera Categoría',
    description: 'Fase de grupos + eliminatorias directas. Incluye pelotas oficiales, hidratación, cóctel de premiación y premios de patrocinadores.',
    tag: 'TORNEO OFICIAL',
  },
  {
    id: 'tennis-clinic',
    title: 'Clínica de Saque & Volea con Coach ITF',
    category: 'Tenis',
    tone: 'orange',
    date: 'Sábado, 25 Oct',
    time: '9:00 AM - 11:00 AM',
    sede: 'Sede El Poblado',
    court: 'Cancha Central de Arcilla',
    spotsLeft: 2,
    totalSpots: 8,
    level: 'Abierto a todos los niveles',
    description: 'Análisis biomecánico en video de tu gesto de saque, corrección de empuñadura y patrones tácticos en la red.',
    tag: 'MASTERCLASS',
  },
  {
    id: 'swim-endurance',
    title: 'Taller de Resistencia & Virajes en Piscina',
    category: 'Natación',
    tone: 'blue',
    date: 'Domingo, 26 Oct',
    time: '8:00 AM - 10:00 AM',
    sede: 'Sede Laureles',
    court: 'Piscina Semiolímpica Climatizada',
    spotsLeft: 5,
    totalSpots: 12,
    level: 'Intermedio',
    description: 'Perfeccionamiento del viraje olímpico, ritmo de patada continua y reducción de arrastre hidrodinámico.',
    tag: 'TÉCNICA PRO',
  },
  {
    id: 'sunset-recovery',
    title: 'Sunset Yoga & Movilidad Post-Entreno',
    category: 'Wellness',
    tone: 'purple',
    date: 'Miércoles, 29 Oct',
    time: '6:30 PM - 8:00 PM',
    sede: 'Sede El Poblado',
    court: 'Terraza Rooftop & Zona Húmeda',
    spotsLeft: 8,
    totalSpots: 20,
    level: 'Todos los socios',
    description: 'Sesión al atardecer para descomprimir columna y caderas, seguida de infusión desinflamatoria en la terraza social.',
    tag: 'BIENESTAR',
  },
]

export function ClubEvents() {
  return (
    <section className="section-shell club-events-section">
      <div className="section-header-block">
        <div className="eyebrow">
          <Trophy size={13} className="text-brand-lime" /> VIDA EN EL CLUB
        </div>
        <h2>
          Torneos, clínicas y<br /><span>encuentros deportivos.</span>
        </h2>
        <p className="section-heading-sub">
          Forma parte de una comunidad activa. Compite en nuestras ligas internas, perfecciona tu
          juego con entrenadores certificados y disfruta el tercer tiempo con otros socios.
        </p>
      </div>

      <div className="events-grid">
        {EVENTS.map((event) => {
          const isAlmostFull = event.spotsLeft <= 3
          return (
            <article key={event.id} className="event-card">
              <div className="event-card-header">
                <span className={`event-category-tag tag-${event.tone}`}>
                  {event.category} · {event.tag}
                </span>
                <span className={`event-spots-badge ${isAlmostFull ? 'spots-urgent' : ''}`}>
                  <Users size={12} /> {event.spotsLeft} cupos restantes
                </span>
              </div>

              <h3 className="event-title">{event.title}</h3>
              <p className="event-desc">{event.description}</p>

              <div className="event-meta-grid">
                <div className="event-meta-item">
                  <Calendar size={14} className="text-brand-lime" />
                  <span>{event.date}</span>
                </div>
                <div className="event-meta-item">
                  <Clock size={14} className="text-brand-lime" />
                  <span>{event.time}</span>
                </div>
                <div className="event-meta-item col-span-2">
                  <MapPin size={14} className="text-brand-lime" />
                  <span>{event.sede} · {event.court}</span>
                </div>
              </div>

              <div className="event-card-foot">
                <span className="event-level-label">Nivel: <b>{event.level}</b></span>
                <Link
                  href="/portal/book"
                  className="event-register-btn"
                >
                  Inscribirme <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
