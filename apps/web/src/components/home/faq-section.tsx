'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, HelpCircle, MessageSquare } from 'lucide-react'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: 'Reservas' | 'Instalaciones' | 'Pagos' | 'Acceso'
}

const FAQS: FaqItem[] = [
  {
    id: 'anticipacion-reservas',
    question: '¿Con cuánta anticipación puedo reservar una cancha o espacio deportivo?',
    answer:
      'Puedes realizar reservas con una ventana máxima de 15 días calendario de anticipación (calculados en hora oficial de Colombia). El sistema abre los cupos de manera continua día a día a partir de las 00:00 para garantizar equidad y disponibilidad para todos los usuarios.',
    category: 'Reservas',
  },
  {
    id: 'mantenimiento-piscinas-festivo',
    question: '¿Qué ocurre los lunes festivos con el mantenimiento de las piscinas?',
    answer:
      'Las piscinas semiolímpica y de relajación realizan su mantenimiento técnico rutinario los días lunes. Sin embargo, cuando el lunes corresponde a un día festivo en Colombia, las piscinas permanecen abiertas al público y la jornada de mantenimiento se traslada automáticamente al primer día hábil siguiente (martes).',
    category: 'Instalaciones',
  },
  {
    id: 'modelo-cashless-pagos',
    question: '¿Cómo funciona el pago y qué métodos son aceptados?',
    answer:
      'AKROS opera bajo un modelo 100% Cashless para agilizar el ingreso y maximizar la seguridad. Todos los pagos de reservas, membresías y consumos se procesan en línea mediante Stripe con tarjetas de crédito, débito o PSE. No se recibe dinero en efectivo en taquilla.',
    category: 'Pagos',
  },
  {
    id: 'pase-digital-qr',
    question: '¿Cómo funciona el Pase Digital QR para ingresar a las instalaciones?',
    answer:
      'Una vez confirmado el pago, se genera automáticamente un código QR dinámico en tu billetera digital (`/portal/tickets`). Puedes presentarlo desde tu smartphone en los lectores ópticos de los torniquetes o compartir la imagen con la persona que asistirá, ya que el pase es transferible sin requerir validación biométrica.',
    category: 'Acceso',
  },
  {
    id: 'membresias-vs-reserva-abierta',
    question: '¿Es obligatorio ser socio o tener membresía para reservar?',
    answer:
      'No. Nuestras instalaciones están abiertas al público general bajo la modalidad de reserva por turnos horarios. Sin embargo, los planes de membresía (Active, Pro y Elite) ofrecen hasta un 30% de descuento en todas las tarifas, acceso preferente a horarios de alta demanda y uso ilimitado del circuito wellness y coworking.',
    category: 'Reservas',
  },
  {
    id: 'indumentaria-equipamiento',
    question: '¿Qué indumentaria o implementos debo llevar para entrenar?',
    answer:
      'Cada disciplina exige calzado deportivo apto para la superficie (suela omni/espiga para pádel, suela lisa para arcilla de tenis, o calzado sintético sin taches de aluminio). Para las zonas acuáticas es obligatorio el uso de gorro de baño y traje de licra. Contamos con alquiler de palas profesionales y lockers en vestieres.',
    category: 'Instalaciones',
  },
]

export function FaqSection() {
  const [openIds, setOpenIds] = useState<string[]>(['anticipacion-reservas'])
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')

  const categories = ['Todas', 'Reservas', 'Instalaciones', 'Pagos', 'Acceso']

  const toggleFaq = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const filteredFaqs =
    selectedCategory === 'Todas'
      ? FAQS
      : FAQS.filter((faq) => faq.category === selectedCategory)

  return (
    <section className="section-shell faq-section" id="faq">
      <div className="section-header-block text-center max-w-2xl mx-auto">
        <div className="eyebrow justify-center">
          <HelpCircle size={13} className="text-brand-lime" /> PREGUNTAS FRECUENTES
        </div>
        <h2>
          Todo lo que necesitas saber antes de <span>tu visita.</span>
        </h2>
        <p className="section-heading-sub mx-auto">
          Consulta nuestras políticas de reserva, reglamentos y funcionamiento 100% cashless.
        </p>
      </div>

      {/* Filtro por categorías */}
      <div className="faq-category-pills" role="tablist" aria-label="Categorías de preguntas">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={selectedCategory === cat}
            className={`faq-pill-btn ${selectedCategory === cat ? 'faq-pill-active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Lista Acordeón de FAQs */}
      <div className="faq-accordion-wrap">
        {filteredFaqs.map((faq) => {
          const isOpen = openIds.includes(faq.id)
          return (
            <div
              key={faq.id}
              className={`faq-accordion-item ${isOpen ? 'faq-item-open' : ''}`}
            >
              <button
                type="button"
                className="faq-question-btn"
                onClick={() => toggleFaq(faq.id)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${faq.id}`}
              >
                <span className="faq-question-text">{faq.question}</span>
                <span className="faq-category-tag">{faq.category}</span>
                <span className="faq-chevron-box" aria-hidden="true">
                  <ChevronDown
                    size={18}
                    className={`faq-chevron ${isOpen ? 'faq-chevron-rotate' : ''}`}
                  />
                </span>
              </button>
              {isOpen && (
                <div
                  id={`faq-answer-${faq.id}`}
                  role="region"
                  className="faq-answer-content"
                >
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Banner de soporte directo */}
      <div className="faq-support-strip">
        <div className="flex items-center gap-3">
          <div className="faq-support-icon">
            <MessageSquare size={18} />
          </div>
          <div>
            <h4>¿Tienes alguna duda sobre tus reservas o requerimientos especiales?</h4>
            <p>Nuestro equipo de atención al socio está disponible todos los días de 06:00 a 22:00.</p>
          </div>
        </div>
        <Link href="/legal" className="text-link faq-support-link">
          Ver reglamentos oficiales <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  )
}
