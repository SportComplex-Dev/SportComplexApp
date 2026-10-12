'use client'

import { Sun, Zap } from 'lucide-react'

interface LiveConditionsProps {
  className?: string
}

export function LiveConditions({ className = '' }: LiveConditionsProps) {
  return (
    <div className={`live-conditions-bar ${className}`} aria-label="Condiciones meteorológicas y operativas en vivo">
      <div className="live-condition-chip" title="Temperatura ambiente en sede El Poblado, Medellín">
        <Sun size={13} />
        <span>23°C · El Poblado</span>
      </div>
      <div className="live-condition-chip" title="Estado de canchas y pistas deportivas">
        <span className="live-dot" />
        <span>Pistas Secas · Juego Óptimo</span>
      </div>
      <div className="live-condition-chip" title="Iluminación LED nocturna de alta potencia activa">
        <Zap size={13} />
        <span>Iluminación LED Activa</span>
      </div>
    </div>
  )
}
