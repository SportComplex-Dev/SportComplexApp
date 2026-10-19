'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface HeroSlide {
  id: string
  src: string
  alt: string
  title: string
  subtitle: string
  tag: string
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'principal',
    src: '/images/club-hero.png',
    alt: 'Sede Principal del Club AKROS SportComplex en Medellín',
    title: 'Club Deportivo Integral',
    subtitle: 'Sede Central & Instalaciones Multideporte',
    tag: 'SEDE CENTRAL',
  },
  {
    id: 'padel',
    src: '/images/hero-padel-courts.jpg',
    alt: 'Canchas Panorámicas de Pádel y Tenis en AKROS',
    title: 'Pistas Profesionales de Pádel',
    subtitle: 'Césped Pro WPT & Iluminación LED Nocturna',
    tag: 'PÁDEL & TENIS',
  },
  {
    id: 'natacion',
    src: '/images/hero-swimming-pool.jpg',
    alt: 'Piscina Semiolímpica Climatizada en AKROS',
    title: 'Complejo Acuático Climatizado',
    subtitle: 'Lanes de Natación Libre y Entrenamiento',
    tag: 'PISCINA & SPA',
  },
  {
    id: 'fitness',
    src: '/images/hero-fitness-zone.jpg',
    alt: 'Área de Alto Rendimiento y Entrenamiento Funcional',
    title: 'Centro de Fuerza y Rendimiento',
    subtitle: 'Equipamiento de Élite & Pistas Indoor',
    tag: 'FITNESS & GYM',
  },
  {
    id: 'clubhouse',
    src: '/images/hero-clubhouse-lounge.jpg',
    alt: 'Club House Social y Terraza Panorámica de AKROS',
    title: 'Club House & Terraza Lounge',
    subtitle: 'Gastronomía, Vista Panorámica y Comunidad',
    tag: 'ZONA SOCIAL',
  },
]

export const SLIDE_DURATION_MS = 4000

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartXRef = useRef<number | null>(null)
  const touchEndXRef = useRef<number | null>(null)

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % HERO_SLIDES.length)
  }, [])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  }, [])

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index)
  }, [])

  // Autoplay reactivo: se reinicia cada vez que cambia currentIndex o se sale de pausa
  // Respeta prefers-reduced-motion y pausa en hover/foco
  useEffect(() => {
    if (isPaused) return

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReducedMotion) return
    }

    const timer = setInterval(() => {
      goToNext()
    }, SLIDE_DURATION_MS)

    return () => clearInterval(timer)
  }, [currentIndex, isPaused, goToNext])

  // Controles con teclado (Flechas Izquierda / Derecha)
  // Ignora eventos si el foco está en un input, textarea o contenido editable
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isInput) return

      if (event.key === 'ArrowLeft') {
        goToPrev()
      } else if (event.key === 'ArrowRight') {
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrev])

  // Gestos táctiles y accesibilidad (hover / foco) vinculados al contenedor padre (.hero-wrap)
  useEffect(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return

    const handleTouchStart = (e: TouchEvent) => {
      touchStartXRef.current = e.targetTouches[0]?.clientX ?? null
    }

    const handleTouchMove = (e: TouchEvent) => {
      touchEndXRef.current = e.targetTouches[0]?.clientX ?? null
    }

    const handleTouchEnd = () => {
      if (touchStartXRef.current === null || touchEndXRef.current === null) return
      const distance = touchStartXRef.current - touchEndXRef.current
      const minSwipeDistance = 50

      if (distance > minSwipeDistance) {
        goToNext()
      } else if (distance < -minSwipeDistance) {
        goToPrev()
      }

      touchStartXRef.current = null
      touchEndXRef.current = null
    }

    const handleMouseEnter = () => setIsPaused(true)
    const handleMouseLeave = () => setIsPaused(false)
    const handleFocusIn = () => setIsPaused(true)
    const handleFocusOut = (e: FocusEvent) => {
      if (!parent.contains(e.relatedTarget as Node | null)) {
        setIsPaused(false)
      }
    }

    parent.addEventListener('touchstart', handleTouchStart, { passive: true })
    parent.addEventListener('touchmove', handleTouchMove, { passive: true })
    parent.addEventListener('touchend', handleTouchEnd)
    parent.addEventListener('mouseenter', handleMouseEnter)
    parent.addEventListener('mouseleave', handleMouseLeave)
    parent.addEventListener('focusin', handleFocusIn)
    parent.addEventListener('focusout', handleFocusOut)

    return () => {
      parent.removeEventListener('touchstart', handleTouchStart)
      parent.removeEventListener('touchmove', handleTouchMove)
      parent.removeEventListener('touchend', handleTouchEnd)
      parent.removeEventListener('mouseenter', handleMouseEnter)
      parent.removeEventListener('mouseleave', handleMouseLeave)
      parent.removeEventListener('focusin', handleFocusIn)
      parent.removeEventListener('focusout', handleFocusOut)
    }
  }, [goToNext, goToPrev])

  const activeSlide = HERO_SLIDES[currentIndex] || HERO_SLIDES[0]!

  return (
    <div
      ref={containerRef}
      className="hero-carousel absolute inset-0 z-0 overflow-hidden select-none touch-pan-y"
      role="region"
      aria-roledescription="carousel"
      aria-label="Carrusel de instalaciones del complejo deportivo AKROS"
    >
      {/* Capas de Imágenes con Cross-Fade */}
      {HERO_SLIDES.map((slide, index) => {
        const isActive = index === currentIndex
        return (
          <div
            key={slide.id}
            aria-hidden={!isActive}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              isActive ? 'opacity-100 -z-10 scale-100' : 'opacity-0 -z-20 scale-105 pointer-events-none'
            } transform transition-transform duration-[4000ms] pointer-events-none`}
          >
            <Image
              src={slide.src}
              alt={slide.alt}
              fill
              priority={index === 0}
              quality={90}
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
        )
      })}

      {/* Superposición de Gradientes Cinematográficos para Máximo Contraste */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(8, 29, 21, 0.92) 0%, rgba(8, 29, 21, 0.78) 36%, rgba(8, 29, 21, 0.28) 58%, rgba(8, 29, 21, 0.05) 80%, transparent 100%), linear-gradient(0deg, rgba(10, 29, 22, 0.35) 0%, transparent 28%)',
        }}
      />

      {/* Badge Informativo de la Foto Activa (Esquina superior derecha) */}
      <div className="absolute top-6 right-6 md:top-8 md:right-12 z-20 hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white shadow-lg animate-fade-in pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-[var(--brand-accent,#c9ef75)] animate-pulse" />
        <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--brand-accent,#c9ef75)]">
          {activeSlide.tag}
        </span>
        <span className="text-white/40 text-xs">•</span>
        <span className="text-xs font-medium text-white/90 max-w-[200px] truncate">
          {activeSlide.title}
        </span>
      </div>

      {/* Flecha Izquierda (Extremo Izquierdo) */}
      <button
        type="button"
        onClick={goToPrev}
        className="absolute left-2 sm:left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white transition-all cursor-pointer hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent,#c9ef75)] pointer-events-auto"
        aria-label="Anterior"
        title="Anterior"
      >
        <ChevronLeft size={18} className="sm:hidden" />
        <ChevronLeft size={20} className="hidden sm:inline" />
      </button>

      {/* Flecha Derecha (Extremo Derecho) */}
      <button
        type="button"
        onClick={goToNext}
        className="absolute right-2 sm:right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white transition-all cursor-pointer hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent,#c9ef75)] pointer-events-auto"
        aria-label="Siguiente"
        title="Siguiente"
      >
        <ChevronRight size={18} className="sm:hidden" />
        <ChevronRight size={20} className="hidden sm:inline" />
      </button>

      {/* Indicadores de Diapositiva Centrados en la Parte Inferior */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2 pointer-events-auto"
        role="tablist"
        aria-label="Indicadores de fotos del carrusel"
      >
        {HERO_SLIDES.map((slide, index) => {
          const isActive = index === currentIndex
          return (
            <button
              key={slide.id}
              role="tab"
              aria-selected={isActive}
              aria-label={`Ir a foto ${index + 1}: ${slide.title}`}
              onClick={() => goToSlide(index)}
              className={`group relative h-2 rounded-full overflow-hidden transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent,#c9ef75)] ${
                isActive ? 'w-8 bg-white/30' : 'w-2 bg-white/30 hover:bg-white/50'
              }`}
            >
              {isActive && (
                <span
                  key={`progress-${currentIndex}`}
                  className="absolute left-0 top-0 bottom-0 rounded-full bg-[var(--brand-accent,#c9ef75)]"
                  style={{
                    animation: `hero-pill-fill ${SLIDE_DURATION_MS}ms linear forwards`,
                    animationPlayState: isPaused ? 'paused' : 'running',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
