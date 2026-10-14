'use client'

import React, { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Calendar, Clock, MapPin, Trophy, Users, CheckCircle2 } from 'lucide-react'
import {
  TournamentRegistrationModal,
  type TournamentRegisterTarget,
} from './tournament-registration-modal'
import { useApp } from '@/components/app-provider'

interface ClubEventView {
  id: string
  title: string
  category: string
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
  isDynamic?: boolean
  yaInscrito?: boolean
  rawTournament?: TournamentRegisterTarget
}

const STATIC_EVENTS: ClubEventView[] = [
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

function getCategoryTone(categoryName: string = ''): 'lime' | 'blue' | 'orange' | 'purple' {
  const norm = categoryName.toLowerCase()
  if (norm.includes('pádel') || norm.includes('padel')) return 'lime'
  if (norm.includes('tenis')) return 'orange'
  if (norm.includes('piscina') || norm.includes('natación') || norm.includes('acuát')) return 'blue'
  return 'purple'
}

export function ClubEvents() {
  const { notify } = useApp()
  const shouldReduceMotion = useReducedMotion()
  const [events, setEvents] = useState<ClubEventView[]>(STATIC_EVENTS)
  const [selectedTournament, setSelectedTournament] = useState<TournamentRegisterTarget | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Cargar torneos reales desde la API pública /api/tournaments
  useEffect(() => {
    let active = true

    fetch('/api/tournaments?estado=INSCRIPCIONES_ABIERTAS')
      .then((res) => res.json())
      .then((json) => {
        if (!active) return
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const dynamicList: ClubEventView[] = json.data.map((t: TournamentRegisterTarget) => {
            const catNombre = t.categoria?.nombre || 'Deporte'
            const tone = getCategoryTone(catNombre)
            const fInicio = new Date(t.fechaInicio)
            const fFin = new Date(t.fechaFin)

            const dateStr = fInicio.toLocaleDateString('es-CO', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })

            const timeStr = `${fInicio.toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })} - ${fFin.toLocaleTimeString('es-CO', {
              hour: '2-digit',
              minute: '2-digit',
            })}`

            const precio = Number(t.precioInscripcion ?? 0)
            const tag = precio === 0 ? 'GRATUITO' : `$${precio.toLocaleString('es-CO')} COP`
            const spotsLeft = t.cuposDisponibles ?? Math.max(0, t.cuposTotales - t.cuposOcupados)

            return {
              id: t.id,
              title: t.titulo,
              category: catNombre,
              tone,
              date: dateStr,
              time: timeStr,
              sede: 'Sede Principal',
              court: 'Pistas Asignadas',
              spotsLeft,
              totalSpots: t.cuposTotales,
              level: t.nivel,
              description: t.descripcion || 'Torneo oficial del club con control de cupos y entrada digital.',
              tag,
              isDynamic: true,
              yaInscrito: t.yaInscrito,
              rawTournament: t,
            }
          })

          setEvents(dynamicList)
        }
      })
      .catch((err) => {
        console.error('Error cargando torneos dinámicos:', err)
      })

    return () => {
      active = false
    }
  }, [])

  const handleOpenRegister = (eventItem: ClubEventView) => {
    if (eventItem.rawTournament && eventItem.isDynamic) {
      setSelectedTournament(eventItem.rawTournament)
      setIsModalOpen(true)
    } else {
      notify('Este evento o clínica deportiva se gestiona directamente en la recepción del club.', 'info')
    }
  }

  const handleRegistrationSuccess = (tournamentId: string) => {
    setEvents((prev) =>
      prev.map((ev) =>
        ev.id === tournamentId
          ? {
              ...ev,
              spotsLeft: Math.max(0, ev.spotsLeft - 1),
              yaInscrito: true,
            }
          : ev
      )
    )
  }

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
        {events.map((event) => {
          const isAlmostFull = event.spotsLeft <= 3
          return (
            <motion.article
              key={event.id}
              whileHover={shouldReduceMotion ? undefined : { y: -6, transition: { type: 'spring', stiffness: 320, damping: 20 } }}
              className="event-card transition-colors"
            >
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
                {event.yaInscrito ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                    <CheckCircle2 size={13} /> Inscrito
                  </span>
                ) : event.isDynamic ? (
                  <motion.button
                    type="button"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                    onClick={() => handleOpenRegister(event)}
                    className="event-register-btn cursor-pointer inline-flex items-center gap-1.5"
                  >
                    Inscribirme <ArrowRight size={14} />
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                    whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                    onClick={() => handleOpenRegister(event)}
                    className="event-register-btn cursor-pointer inline-flex items-center gap-1.5 opacity-90"
                    title="Taller especial gestionado directamente en sede"
                  >
                    Consultar en Sede <ArrowRight size={14} />
                  </motion.button>
                )}
              </div>
            </motion.article>
          )
        })}
      </div>

      {/* Modal de Inscripción Reactivo */}
      <TournamentRegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tournament={selectedTournament}
        onRegistrationSuccess={handleRegistrationSuccess}
      />
    </section>
  )
}
