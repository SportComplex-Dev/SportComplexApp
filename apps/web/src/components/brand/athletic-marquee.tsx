'use client'

export function AthleticMarquee() {
  const marqueeItems = [
    { text: 'Torneo de Pádel Nocturno', badge: 'Viernes 8 PM' },
    { text: 'Canchas de Tenis Polvo de Ladrillo', badge: 'Disponibles' },
    { text: 'Piscina Climatizada y Carriles de Nado', badge: 'Sede Poblado' },
    { text: 'Zona Wellness · Sauna y Jacuzzi', badge: 'Abierta' },
    { text: 'Fútbol 5 Techado con Césped Sintético Pro', badge: 'Turnos Hoy' },
    { text: 'Sede Poblado Abierta hasta las 11:00 PM', badge: 'En Vivo' },
  ]

  // Duplicado exacto para un bucle continuo e imperceptible al 50%
  const duplicated = [...marqueeItems, ...marqueeItems]

  return (
    <div className="athletic-marquee-wrap" aria-label="Novedades e instalaciones en vivo de Altura Club">
      <div className="athletic-marquee-track">
        {duplicated.map((item, index) => (
          <div key={index} className="marquee-item">
            <span className="marquee-dot" />
            <span>{item.text}</span>
            <span className="marquee-badge">{item.badge}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
