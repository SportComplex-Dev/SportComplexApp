'use client'

import { useEffect, useState } from 'react'

export function SplashScreen() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    setMounted(true)
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const forceSplash = searchParams?.get('splash') === 'true' || searchParams?.get('splash') === '1'
    const dismissed = sessionStorage.getItem('akros_splash_dismissed')

    if (forceSplash || !dismissed) {
      setVisible(true)
      setClosing(false)
      if (!forceSplash) {
        const closeTimer = setTimeout(() => {
          setClosing(true)
          const removeTimer = setTimeout(() => {
            setVisible(false)
            sessionStorage.setItem('akros_splash_dismissed', 'true')
          }, 650)
          return () => clearTimeout(removeTimer)
        }, 1800)
        return () => clearTimeout(closeTimer)
      }
    }
  }, [])

  if (!mounted || !visible) return null

  return (
    <div
      className={`splash-overlay ${closing ? 'splash-closing' : ''}`}
      aria-label="Cargando experiencia AKROS Active Lifestyle Club"
      role="dialog"
      aria-modal="true"
      onClick={() => setClosing(true)}
    >
      <div className="splash-backdrop-texture" />
      <div className="splash-ambient-glow" />

      <div className="splash-card">
        <div className="splash-card-inner">
          <div className="splash-energy-wave" />
          <img
            src="/images/Akros-logo.png"
            alt="AKROS Active Lifestyle Club"
            className="splash-logo"
            width={120}
            height={100}
          />
        </div>
        <div className="splash-progress-track">
          <div className="splash-progress-bar" />
        </div>
      </div>

      <div className="splash-brand-title">
        <b>AKROS</b>
        <span>ACTIVE LIFESTYLE CLUB</span>
      </div>

      <span className="splash-skip-hint">Haz clic para omitir</span>
    </div>
  )
}
