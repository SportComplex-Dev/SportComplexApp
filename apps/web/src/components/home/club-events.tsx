'use client'

import React, { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Users,
  CheckCircle2,
  Info,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  TournamentRegistrationModal,
  PublicTournamentDetailModal,
  type TournamentRegisterTarget,
  type PublicTournamentDetailData,
} from '@sportcomplex/features-tournament'
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
  rawTournament?: PublicTournamentDetailData
}

const STATIC_EVENTS: ClubEventView[] = [
  {
    id: '071522c5-8967-4647-b934-fd2c3c821150',
    title: 'Torneo Relámpago Nocturno de Pádel',
    category: 'Pádel',
    tone: 'lime',
    date: 'Miércoles, 21 Oct',
    time: '7:00 PM - 11:00 PM',
    sede: 'Sede Principal SportComplex',
    court: 'Pádel · Cancha 1',
    spotsLeft: 12,
    totalSpots: 16,
    level: 'Segunda & Tercera Categoría',
    description: 'Fase de grupos + eliminatorias directas. Incluye pelotas oficiales, hidratación, cóctel de premiación y premios de patrocinadores.',
    tag: 'GRATUITO',
    isDynamic: true,
    rawTournament: {
      id: '071522c5-8967-4647-b934-fd2c3c821150',
      titulo: 'Torneo Relámpago Nocturno de Pádel',
      descripcion: 'Fase de grupos + eliminatorias directas. Incluye pelotas oficiales, hidratación, cóctel de premiación y premios de patrocinadores.',
      nivel: 'Segunda & Tercera Categoría',
      categoria: { nombre: 'Pádel' },
      fechaInicio: new Date(Date.now() + 5 * 86400000).toISOString(),
      fechaFin: new Date(Date.now() + 5 * 86400000 + 14400000).toISOString(),
      cuposTotales: 16,
      cuposOcupados: 4,
      cuposDisponibles: 12,
      precioInscripcion: 0,
      court: 'Pádel · Cancha 1',
      sede: 'Sede Principal SportComplex',
    },
  },
  {
    id: '9b4a4c0e-2fb7-4dc0-ab7d-d8132e65b8e4',
    title: 'Copa Primavera de Tenis Individual & Dobles',
    category: 'Tenis',
    tone: 'orange',
    date: 'Sábado, 24 Oct',
    time: '8:00 AM - 6:00 PM',
    sede: 'Sede Principal SportComplex',
    court: 'Cancha de Tenis Polvo de Ladrillo',
    spotsLeft: 7,
    totalSpots: 12,
    level: 'Intermedio / Avanzado',
    description: 'Cuadro principal a 3 sets con super tie-break. Canchas centrales de arcilla con arbitraje profesional en finales. Kit de bienvenida conmemorativo.',
    tag: 'GRATUITO',
    isDynamic: true,
    rawTournament: {
      id: '9b4a4c0e-2fb7-4dc0-ab7d-d8132e65b8e4',
      titulo: 'Copa Primavera de Tenis Individual & Dobles',
      descripcion: 'Cuadro principal a 3 sets con super tie-break. Canchas centrales de arcilla con arbitraje profesional en finales. Kit de bienvenida conmemorativo.',
      nivel: 'Intermedio / Avanzado',
      categoria: { nombre: 'Tenis' },
      fechaInicio: new Date(Date.now() + 8 * 86400000).toISOString(),
      fechaFin: new Date(Date.now() + 8 * 86400000 + 36000000).toISOString(),
      cuposTotales: 12,
      cuposOcupados: 5,
      cuposDisponibles: 7,
      precioInscripcion: 0,
      court: 'Cancha de Tenis Polvo de Ladrillo',
      sede: 'Sede Principal SportComplex',
    },
  },
  {
    id: '0b2123a0-31cb-47b2-85fc-0c6aa8c15f8e',
    title: 'Desafío Acuático 100m Estilo Libre & Relevos',
    category: 'Natación',
    tone: 'blue',
    date: 'Miércoles, 28 Oct',
    time: '9:00 AM - 2:00 PM',
    sede: 'Sede Principal SportComplex',
    court: 'Piscina Semiolímpica Climatizada',
    spotsLeft: 12,
    totalSpots: 20,
    level: 'Todos los niveles',
    description: 'Competencia contrarreloj en piscina semiolímpica climatizada con cronometraje electrónico touch-pad. Categorías individual y relevos.',
    tag: 'GRATUITO',
    isDynamic: true,
    rawTournament: {
      id: '0b2123a0-31cb-47b2-85fc-0c6aa8c15f8e',
      titulo: 'Desafío Acuático 100m Estilo Libre & Relevos',
      descripcion: 'Competencia contrarreloj en piscina semiolímpica climatizada con cronometraje electrónico touch-pad. Categorías individual y relevos.',
      nivel: 'Todos los niveles',
      categoria: { nombre: 'Natación' },
      fechaInicio: new Date(Date.now() + 12 * 86400000).toISOString(),
      fechaFin: new Date(Date.now() + 12 * 86400000 + 18000000).toISOString(),
      cuposTotales: 20,
      cuposOcupados: 8,
      cuposDisponibles: 12,
      precioInscripcion: 0,
      court: 'Piscina Semiolímpica Climatizada',
      sede: 'Sede Principal SportComplex',
    },
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
  const router = useRouter()
  const { session, notify } = useApp()
  const shouldReduceMotion = useReducedMotion()
  const [events, setEvents] = useState<ClubEventView[]>(STATIC_EVENTS)
  const [loading, setLoading] = useState(true)

  // Modales
  const [selectedTournament, setSelectedTournament] = useState<TournamentRegisterTarget | null>(null)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [selectedDetailTournament, setSelectedDetailTournament] = useState<PublicTournamentDetailData | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

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

            const assignedCourts =
              t.bloqueos && t.bloqueos.length > 0 && t.bloqueos[0]?.servicio?.nombre
                ? t.bloqueos
                    .map((b: { servicio?: { nombre?: string } }) => b.servicio?.nombre)
                    .filter(Boolean)
                    .join(', ')
                : 'Pistas Asignadas'

            const publicData: PublicTournamentDetailData = {
              ...t,
              court: assignedCourts,
              sede: 'Sede Principal SportComplex',
              tone,
            }

            return {
              id: t.id,
              title: t.titulo,
              category: catNombre,
              tone,
              date: dateStr,
              time: timeStr,
              sede: 'Sede Principal',
              court: assignedCourts,
              spotsLeft,
              totalSpots: t.cuposTotales,
              level: t.nivel,
              description: t.descripcion || 'Torneo oficial del club con control de cupos y entrada digital.',
              tag,
              isDynamic: true,
              yaInscrito: t.yaInscrito,
              rawTournament: publicData,
            }
          })

          setEvents(dynamicList)
        }
      })
      .catch((err) => {
        console.error('Error cargando torneos dinámicos:', err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const handleOpenDetails = (eventItem: ClubEventView) => {
    if (eventItem.rawTournament) {
      setSelectedDetailTournament({
        ...eventItem.rawTournament,
        yaInscrito: eventItem.yaInscrito,
        cuposDisponibles: eventItem.spotsLeft,
      })
    } else {
      setSelectedDetailTournament({
        id: eventItem.id,
        titulo: eventItem.title,
        descripcion: eventItem.description,
        nivel: eventItem.level,
        categoria: { nombre: eventItem.category },
        fechaInicio: new Date().toISOString(),
        fechaFin: new Date().toISOString(),
        cuposTotales: eventItem.totalSpots,
        cuposDisponibles: eventItem.spotsLeft,
        cuposOcupados: eventItem.totalSpots - eventItem.spotsLeft,
        precioInscripcion: 0,
        court: eventItem.court,
        sede: eventItem.sede,
        tone: eventItem.tone,
        yaInscrito: eventItem.yaInscrito,
      })
    }
    setIsDetailModalOpen(true)
  }

  const handleOpenRegister = (eventItem: ClubEventView) => {
    if (eventItem.rawTournament && eventItem.isDynamic) {
      setSelectedTournament(eventItem.rawTournament)
      setIsRegisterModalOpen(true)
    } else if (eventItem.rawTournament) {
      // Si es un evento estático de recepción, abrir detalle con información completa
      setSelectedDetailTournament(eventItem.rawTournament)
      setIsDetailModalOpen(true)
      notify('Para inscribirte en esta clínica deportiva, acércate a la recepción o confirma tu asistencia.', 'info')
    } else {
      notify('Información de torneo no disponible temporalmente.', 'error')
    }
  }

  const handleRegisterFromDetail = (detailData: PublicTournamentDetailData) => {
    setIsDetailModalOpen(false)
    if (detailData.id && detailData.id.length > 20) {
      // UUID válido de base de datos
      setSelectedTournament(detailData)
      setIsRegisterModalOpen(true)
    } else {
      notify('Este taller deportivo se confirma directamente con el equipo técnico en sede.', 'info')
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
              rawTournament: ev.rawTournament
                ? {
                    ...ev.rawTournament,
                    yaInscrito: true,
                    cuposOcupados: (ev.rawTournament.cuposOcupados ?? 0) + 1,
                    cuposDisponibles: Math.max(0, (ev.rawTournament.cuposDisponibles ?? ev.spotsLeft) - 1),
                  }
                : undefined,
            }
          : ev
      )
    )
  }

  return (
    <section className="section-shell club-events-section" id="torneos">
      <div className="section-header-block">
        <div className="eyebrow">
          <Trophy size={13} className="text-brand-lime" /> VIDA EN EL CLUB
        </div>
        <h2>
          Torneos, clínicas y<br />
          <span>encuentros deportivos.</span>
        </h2>
        <p className="section-heading-sub">
          Forma parte de una comunidad activa. Compite en nuestras ligas internas, perfecciona tu
          juego con entrenadores certificados y disfruta el tercer tiempo con otros socios.
        </p>
      </div>

      <div className="events-grid">
        {loading
          ? Array.from({ length: 3 }).map((_, idx) => (
              <article key={`skeleton-${idx}`} className="event-card animate-pulse">
                <div className="event-card-header">
                  <div className="h-5 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded my-2" />
                <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="h-16 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl my-2" />
                <div className="event-card-foot">
                  <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="flex gap-2">
                    <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              </article>
            ))
          : events.map((event) => {
              const isAlmostFull = event.spotsLeft <= 3
              return (
                <motion.article
                  key={event.id}
                  whileHover={shouldReduceMotion ? undefined : { y: -6, transition: { type: 'spring', stiffness: 320, damping: 20 } }}
                  className="event-card tournament-card transition-colors"
                >
                  <div className="event-card-header">
                    <span className={`event-category-tag tag-${event.tone}`}>
                      {event.category} · {event.tag}
                    </span>
                    <span className={`event-spots-badge ${isAlmostFull ? 'spots-urgent' : ''}`}>
                      <Users size={12} /> {event.spotsLeft} cupos restantes
                    </span>
                  </div>

                  <h3
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenDetails(event)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleOpenDetails(event)
                      }
                    }}
                    className="event-title cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    title="Click para ver detalles del torneo"
                  >
                    {event.title}
                  </h3>
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
                      <span>
                        {event.sede} · {event.court}
                      </span>
                    </div>
                  </div>

                  <div className="event-card-foot">
                    <span className="event-level-label">
                      Nivel: <b>{event.level}</b>
                    </span>

                    <div className="event-card-actions">
                      <motion.button
                        type="button"
                        whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                        onClick={() => handleOpenDetails(event)}
                        className="event-detail-btn"
                        aria-label={`Ver detalles de ${event.title}`}
                      >
                        <Info size={13} /> Detalles
                      </motion.button>

                      {event.yaInscrito ? (
                        <motion.button
                          type="button"
                          whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                          onClick={() => handleOpenDetails(event)}
                          className="event-registered-badge"
                          title="Ya estás formalmente inscrito. Click para ver comprobante."
                        >
                          <CheckCircle2 size={13} /> Inscrito
                        </motion.button>
                      ) : event.spotsLeft <= 0 ? (
                        <button
                          type="button"
                          disabled
                          className="event-register-btn opacity-50 cursor-not-allowed"
                        >
                          Agotado
                        </button>
                      ) : (
                        <motion.button
                          type="button"
                          whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                          whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                          onClick={() => handleOpenRegister(event)}
                          className="event-register-btn cursor-pointer inline-flex items-center gap-1.5"
                          aria-label={`Inscribirme a ${event.title}`}
                        >
                          Inscribirme <ArrowRight size={14} />
                        </motion.button>
                      )}
                    </div>
                  </div>
                </motion.article>
              )
            })}
      </div>

      {/* Modal de Información Completa del Torneo */}
      <PublicTournamentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        tournament={selectedDetailTournament}
        onRegisterClick={handleRegisterFromDetail}
      />

      {/* Modal de Inscripción Reactivo con Control Atómico de Cupos y QR Seguro */}
      <TournamentRegistrationModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        tournament={selectedTournament}
        onRegistrationSuccess={handleRegistrationSuccess}
        session={session}
        notify={notify}
        onNavigateToLogin={(callbackUrl) => router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)}
        onNavigateToTickets={() => router.push('/portal/tickets')}
      />
    </section>
  )
}
