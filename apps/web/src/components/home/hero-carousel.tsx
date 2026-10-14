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

const SLIDE_DURATION_MS = 4000

export function HeroCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
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

  // Autoplay continuo de 4 segundos sin interrupción
  useEffect(() => {
    const timer = setInterval(() => {
      goToNext()
    }, SLIDE_DURATION_MS)

    return () => clearInterval(timer)
  }, [goToNext])

  // Controles con teclado (Flechas Izquierda / Derecha)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        goToPrev()
      } else if (event.key === 'ArrowRight') {
        goToNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToNext, goToPrev])

  // Gestos táctiles en dispositivos móviles (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0]?.clientX ?? null
  }

  const handleTouchMove = (e: React.TouchEvent) => {
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

  const activeSlide = HERO_SLIDES[currentIndex] || HERO_SLIDES[0]!

  return (
    <div
      className="absolute inset-0 overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
              isActive ? 'opacity-100 z-0 scale-100' : 'opacity-0 -z-10 scale-105 pointer-events-none'
            } transform transition-transform duration-[4000ms]`}
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
        className="absolute inset-0 z-1 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(8, 29, 21, 0.92) 0%, rgba(8, 29, 21, 0.78) 36%, rgba(8, 29, 21, 0.28) 58%, rgba(8, 29, 21, 0.05) 80%, transparent 100%), linear-gradient(0deg, rgba(10, 29, 22, 0.35) 0%, transparent 28%)',
        }}
      />

      {/* Badge Informativo de la Foto Activa (Esquina superior derecha) */}
      <div className="absolute top-6 right-6 md:top-8 md:right-12 z-20 hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-white shadow-lg animate-fade-in">
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
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white transition-all cursor-pointer hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent,#c9ef75)]"
        aria-label="Ver fotografía anterior de las instalaciones"
        title="Anterior"
      >
        <ChevronLeft size={20} />
      </button>

      {/* Flecha Derecha (Extremo Derecho) */}
      <button
        type="button"
        onClick={goToNext}
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center bg-black/40 hover:bg-black/70 backdrop-blur-md border border-white/20 text-white transition-all cursor-pointer hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent,#c9ef75)]"
        aria-label="Ver siguiente fotografía de las instalaciones"
        title="Siguiente"
      >
        <ChevronRight size={20} />
      </button>

      {/* Indicadores de Diapositiva Centrados en la Parte Inferior */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center gap-2"
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
