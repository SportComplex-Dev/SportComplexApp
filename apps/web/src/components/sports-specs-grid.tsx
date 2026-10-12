'use client'

import { Layers, Lightbulb, Trophy, ShieldCheck, Waves, Dumbbell } from 'lucide-react'

interface SportsSpecsGridProps {
  categorySlug: string
  itemId: string
  capacity: number
}

export function SportsSpecsGrid({ categorySlug, itemId, capacity }: SportsSpecsGridProps) {
  const isTennis = itemId.includes('tenis')
  const isPadel = itemId.includes('padel')
  const isPool = categorySlug === 'piscinas'
  const isGym = categorySlug === 'gimnasio'
  const isWetZone = categorySlug === 'zona-humeda'

  const specs = [
    {
      icon: isPool ? Waves : isGym ? Dumbbell : Layers,
      label: 'Superficie / Entorno',
      value: isTennis
        ? 'Polvo de Ladrillo Oficial'
        : isPadel
          ? 'Césped Sintético Panorámico'
          : isPool
            ? 'Agua Climatizada 28°C'
            : isGym
              ? 'Piso Antishock de Alto Impacto'
              : isWetZone
                ? 'Piedra Térmica & Eucalipto'
                : 'Césped Sintético Grado Pro',
    },
    {
      icon: Lightbulb,
      label: 'Iluminación Oficial',
      value: 'LED 500 Lux Antideslumbramiento',
    },
    {
      icon: Trophy,
      label: 'Formato y Capacidad',
      value: capacity > 1 ? `Hasta ${capacity} personas / turno` : 'Entrenamiento Individual',
    },
    {
      icon: ShieldCheck,
      label: 'Equipamiento Incluido',
      value: isTennis || isPadel
        ? 'Raquetas y bolas presurizadas'
        : isPool
          ? 'Carriles y tablas de entreno'
          : isWetZone
            ? 'Toallas y aromaterapia natural'
            : 'Lockers, hidratación y toallas',
    },
  ]

  return (
    <div className="sports-specs-grid" aria-label="Especificaciones técnicas oficiales de la instalación">
      {specs.map((spec, index) => {
        const Icon = spec.icon
        return (
          <div key={index} className="sports-spec-card">
            <span className="sports-spec-icon">
              <Icon size={16} />
            </span>
            <div className="sports-spec-content">
              <small>{spec.label}</small>
              <b>{spec.value}</b>
            </div>
          </div>
        )
      })}
    </div>
  )
}
