'use client'

import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, ShieldCheck, Users } from 'lucide-react'
import { categoryBySlug, formatDate, formatMoney } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { categoryIcons } from '@/components/category-icons'
import { IconBox } from '@/components/icon-box'
import { SportsSpecsGrid } from '@/components/sports-specs-grid'
import { AvailabilityCalendar } from '@/components/booking/availability-calendar'
import { ReservationModal } from '@/components/reservation-modal'
import { useApp } from '@/components/app-provider'
import { useBookings, useCatalog, type Booking } from '@/lib/stores'

export default function ServiceBookingPage() {
  const { category: slug, id } = useParams<{ category: string; id: string }>()
  const { notify, ready, session } = useApp()
  const [catalog] = useCatalog()
  const [, setBookings] = useBookings()
  const category = categoryBySlug(slug)
  const item = catalog.find((entry) => entry.id === id && entry.category === slug)

  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlotTime, setSelectedSlotTime] = useState('')
  const [attendees, setAttendees] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!category || !item) notFound()
  if (!ready) return <main className="section-shell booking-page" aria-busy="true" />

  const available = item.status === 'Disponible'
  const isCourt = item.category === 'canchas'
  const isPool = item.category === 'piscinas'
  const isPrivatePool = isPool && item.poolType === 'PRIVADA'
  const effectiveAttendees = isCourt || isPrivatePool ? 1 : attendees
  const total = item.price * effectiveAttendees
  const maxAttendees = Math.max(1, item.capacity)
  const Icon = categoryIcons[category.icon]

  const handleOpenReservation = () => {
    if (!available || !selectedDate || !selectedSlotTime) return
    setIsModalOpen(true)
  }

  const handleConfirmReservation = () => {
    const randomCode = `AKR-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`
    const newBooking: Booking = {
      id: `book-${Date.now()}`,
      code: randomCode,
      client: session?.name || 'Cliente Akros',
      category: item.category,
      service: item.name,
      sede: item.sede,
      date: selectedDate,
      time: selectedSlotTime,
      attendees: isCourt || isPrivatePool ? 1 : attendees,
      amount: total,
      status: 'Confirmada',
    }

    setBookings((prev) => [newBooking, ...prev])
    setIsModalOpen(false)
    notify(
      `¡Reserva confirmada con éxito! Código ${randomCode} para ${item.name} el ${selectedDate} a las ${selectedSlotTime}.`,
      'success'
    )
  }

  return (
    <main className="section-shell booking-page">
      <Link href={`/services/${category.slug}`} className="back-link">
        <ArrowLeft size={15} /> Volver a {category.name.toLowerCase()}
      </Link>
      <div className="booking-layout">
        <section>
          {/* Hero Panorámico de Reserva con Card Glass Flotante */}
          <div className="booking-hero-container">
            <img
              className="booking-cover-image"
              src={item.image || '/images/club-hero.png'}
              alt={item.name}
              onError={(event) => { event.currentTarget.src = '/images/club-hero.png' }}
            />
            <div className="booking-hero-gradient" />

            {/* Contenedor Glassmorphism Flotante con Icono y Detalles */}
            <div className="booking-glass-info-card">
              <IconBox icon={Icon} tone={category.tone} className="booking-glass-icon" />
              <div className="booking-glass-text">
                <div className="booking-glass-title-row">
                  <h1 className="booking-glass-title">
                    {item.name.toLowerCase().startsWith((category.singular || category.name).toLowerCase())
                      ? item.name
                      : `${category.singular || category.name} · ${item.name}`}
                  </h1>
                  {session?.role === 'Administrador' && (
                    <Badge variant="admin" className="ml-2">ADMIN</Badge>
                  )}
                </div>
                <p className="booking-glass-desc">
                  {item.description} · Sede {item.sede}
                </p>
              </div>
            </div>

            {/* Badges Flotantes de Estado y Sede */}
            <div className="booking-bottom-badges">
              <span className="booking-status-badge">
                <i className="live-dot" style={{ background: available ? undefined : '#edb45b' }} />
                {available ? 'DISPONIBLE' : 'NO DISPONIBLE'}
              </span>
              <span className="booking-sede-badge">
                <MapPin size={13} /> Sede {item.sede}
              </span>
              {isPool && (
                <Badge variant={isPrivatePool ? 'secondary' : 'success'} className="text-[11px]">
                  {isPrivatePool ? 'Privada (Exclusiva)' : 'Pública (Aforo)'}
                </Badge>
              )}
            </div>
          </div>

          {/* Ficha técnica deportiva (Superficie, iluminación, equipamiento) */}
          <SportsSpecsGrid categorySlug={category.slug} itemId={item.id} capacity={item.capacity} />

          {/* Divisor estilo líneas de cancha */}
          <div className="court-line-divider" />

          {/* Componente Modular de Calendario y Franjas Horarias (TSK-FE-06, TSK-FE-07, TSK-FE-08) */}
          <div className="demo-card p-6 mt-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-ink">Disponibilidad de Franjas y Horarios</h2>
              <p className="text-xs text-subtle">
                Selecciona la fecha y el turno que deseas reservar. Horarios continuos de 60 minutos.
              </p>
            </div>

            <AvailabilityCalendar
              service={item}
              selectedDate={selectedDate}
              selectedSlotTime={selectedSlotTime}
              onSelectDate={(date) => {
                setSelectedDate(date)
                setSelectedSlotTime('')
              }}
              onSelectSlot={(slot) => {
                setSelectedSlotTime(slot.time)
              }}
            />
          </div>
        </section>

        <aside className="booking-summary">
          <div className="summary-top">
            <div className="eyebrow">RESUMEN DE RESERVA</div>
            <div className="summary-secure"><ShieldCheck size={11} /> Reserva segura</div>
          </div>
          <h3>Tu próximo<br />momento te espera.</h3>
          
          <div className="summary-detail">
            <CalendarDays size={15} />
            <div>
              <small>Fecha</small>
              <b>{selectedDate ? formatDate(selectedDate) : 'Elige un día'}</b>
            </div>
          </div>
          
          <div className="summary-detail">
            <Clock3 size={15} />
            <div>
              <small>Hora y duración</small>
              <b>{selectedSlotTime ? `${selectedSlotTime} · 60 minutos` : 'Elige un horario'}</b>
            </div>
          </div>
          
          <div className="summary-detail">
            <MapPin size={15} />
            <div>
              <small>Sede</small>
              <b>{item.sede}</b>
            </div>
          </div>

          {/* Selector de asistentes para servicios compartidos */}
          {!isCourt && !isPrivatePool && maxAttendees > 1 && (
            <label className="attendee-select">
              <span><Users size={14} /> Asistentes</span>
              <select
                aria-label="Cantidad de asistentes"
                value={attendees}
                onChange={(event) => setAttendees(Number(event.target.value))}
              >
                {Array.from({ length: maxAttendees }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>
                    {count} {count === 1 ? 'persona' : 'personas'}
                  </option>
                ))}
              </select>
            </label>
          )}

          {isPrivatePool && (
            <div className="p-2.5 rounded-lg bg-[var(--surface-soft)] border border-[var(--line)] text-xs text-subtle my-2">
              🏊 <b>Alquiler Exclusivo</b>: Reserva individual completa de la instalación.
            </div>
          )}

          <div className="summary-total">
            <span>Total a pagar</span>
            <b>{formatMoney(total)} <small>COP</small></b>
          </div>

          <button
            type="button"
            className="action-button w-full justify-center"
            onClick={handleOpenReservation}
            disabled={!available || !selectedDate || !selectedSlotTime}
          >
            {selectedSlotTime ? 'Reservar este espacio' : 'Elige una franja arriba'}{' '}
            <ArrowRight size={15} />
          </button>

          <p className="summary-note">
            <ShieldCheck size={11} /> El horario se confirma al completar la reserva.
          </p>
        </aside>
      </div>

      {/* Modal de confirmación de reserva */}
      {isModalOpen && (
        <ReservationModal
          close={() => setIsModalOpen(false)}
          proceed={handleConfirmReservation}
          item={item}
          date={selectedDate}
          time={selectedSlotTime}
          attendees={attendees}
        />
      )}
    </main>
  )
}