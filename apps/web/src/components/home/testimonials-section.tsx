'use client'

import { BadgeCheck, Quote, Star } from 'lucide-react'

interface Testimonial {
  id: string
  name: string
  role: string
  sport: string
  sede: string
  rating: number
  text: string
  avatarInitial: string
  membershipType: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    name: 'Camilo Restrepo',
    role: 'Jugador de Pádel 2ª Categoría',
    sport: 'Pádel Panorámico & Gimnasio',
    sede: 'Sede El Poblado',
    rating: 5,
    text: 'Las pistas de pádel panorámicas tienen el mejor rebote de cristal y la mejor iluminación nocturna de Medellín. Reservar desde el móvil y abrir los torniquetes con el código QR sin hacer filas ahorra muchísimo tiempo.',
    avatarInitial: 'C',
    membershipType: 'Socio Active Club',
  },
  {
    id: '2',
    name: 'Valeria Gómez',
    role: 'Triatleta Aficionada',
    sport: 'Natación & Circuito Wellness',
    sede: 'Sede Laureles',
    rating: 5,
    text: 'Entreno natación a las 06:00 AM antes de entrar a trabajar. El agua con electrólisis salina está siempre a 28°C exactos y no irrita los ojos. Pasar luego al sauna de cedro para desinflamar las piernas es una experiencia de diez.',
    avatarInitial: 'V',
    membershipType: 'Socia Black / Pro',
  },
  {
    id: '3',
    name: 'Mateo Arango',
    role: 'Capitán de Equipo de Fútbol 8',
    sport: 'Fútbol Sintético & Tenis',
    sede: 'Ambas sedes',
    rating: 5,
    text: 'El césped con relleno orgánico de corcho marca una diferencia brutal: no quema en verano y el balón rueda impecable. Además, el ambiente del tercer tiempo en la terraza con café o cerveza fría crea una comunidad deportiva real.',
    avatarInitial: 'M',
    membershipType: 'Socio hace 2 años',
  },
]

export function TestimonialsSection() {
  return (
    <section className="section-shell testimonials-section">
      <div className="section-header-block text-center max-w-xl mx-auto">
        <div className="eyebrow justify-center">
          <Quote size={13} className="text-brand-lime" /> EXPERIENCIAS REALES
        </div>
        <h2>
          Lo que dicen quienes ya viven <span>AKROS.</span>
        </h2>
        <p className="section-heading-sub mx-auto">
          Más de 2.400 atletas, aficionados y familias confían en nuestras instalaciones para
          alcanzar su mejor versión deportiva.
        </p>
      </div>

      <div className="testimonials-grid">
        {TESTIMONIALS.map((item) => (
          <article key={item.id} className="testimonial-card">
            <div className="testimonial-stars">
              {Array.from({ length: item.rating }, (_, i) => (
                <Star key={i} size={15} fill="currentColor" className="text-brand-lime" />
              ))}
            </div>

            <p className="testimonial-quote">"{item.text}"</p>

            <div className="testimonial-author">
              <div className="testimonial-avatar">{item.avatarInitial}</div>
              <div className="testimonial-info">
                <div className="testimonial-name-row">
                  <strong>{item.name}</strong>
                  <BadgeCheck size={14} className="text-brand-lime" />
                </div>
                <small className="testimonial-role">{item.role}</small>
                <span className="testimonial-membership">{item.sport} · {item.sede}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
