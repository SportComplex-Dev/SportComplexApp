'use client'

import { useState } from 'react'
import Link from 'next/link'
import { notFound, useParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, MapPin, Sparkles, Users } from 'lucide-react'
import { categoryBySlug, formatMoney } from '@sportcomplex/core'
import { categoryIcons } from '@/components/category-icons'
import { CategoryFilters } from '@/components/category-filters'
import { IconBox } from '@/components/icon-box'
import { LiveConditions } from '@/components/live-conditions'
import { useCatalog } from '@/lib/stores'

export default function CategoryCatalogPage() {
  const { category: slug } = useParams<{ category: string }>()
  const category = categoryBySlug(slug)
  const [catalog] = useCatalog()
  const [activeFilter, setActiveFilter] = useState('all')

  if (!category) notFound()
  const items = catalog.filter((item) => item.category === category.slug)
  const filteredItems = items.filter((item) => {
    if (activeFilter === 'all') return true
    if (item.subCategory === activeFilter) return true
    return item.id.toLowerCase().includes(activeFilter) || item.name.toLowerCase().includes(activeFilter)
  })
  const Icon = categoryIcons[category.icon]

  return (
    <main className="section-shell app-page">
      <Link href="/services" className="back-link">
        <ArrowLeft size={15} /> Todos los servicios
      </Link>
      <div className="catalog-hero">
        <img
          src={category.image || '/images/club-hero.png'}
          alt={category.name}
          className="catalog-hero-image"
          onError={(event) => {
            event.currentTarget.src = '/images/club-hero.png'
          }}
        />
        <div className="catalog-hero-overlay">
          <div className="catalog-hero-top">
            <span className="catalog-hero-pill">
              <span className="live-dot" />
              <span>Instalaciones oficiales</span>
            </span>
            <LiveConditions />
          </div>
          <div className="catalog-hero-bottom">
            <div className="catalog-hero-text">
              <b>{category.tagline || category.name}</b>
              <p>{category.highlight || category.description}</p>
            </div>
            <span className="catalog-hero-stat">
              <Sparkles size={13} style={{ color: 'var(--brand-accent)' }} />
              <span>
                {items.length} {items.length === 1 ? 'espacio disponible' : 'espacios disponibles'}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="booking-heading catalog-heading">
        <IconBox icon={Icon} tone={category.tone} className="booking-icon" />
        <div>
          <div className="eyebrow">CATÁLOGO</div>
          <h1>{category.name}</h1>
          <p>
            {category.description} · {filteredItems.length}{' '}
            {filteredItems.length === 1 ? 'espacio' : 'espacios'}
          </p>
        </div>
      </div>

      <CategoryFilters
        categorySlug={category.slug}
        activeFilter={activeFilter}
        onChange={setActiveFilter}
      />

      {filteredItems.length === 0 ? (
        <div className="dashboard-empty">
          <span className="empty-icon">
            <Icon size={21} />
          </span>
          <div>
            <b>No hay espacios para este filtro</b>
            <p>Prueba seleccionando «Todas» para ver todas las opciones disponibles.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className="calendar-shortcut"
          >
            Ver todos los espacios
          </button>
        </div>
      ) : (
        <div className="catalog-grid">
          {filteredItems.map((item) => {
            const available = item.status === 'Disponible'
            const href = `/services/${category.slug}/${item.id}`
            const card = (
              <>
                <div className="catalog-card-image">
                  <img
                    src={item.image || '/images/club-hero.png'}
                    alt={item.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.src = '/images/club-hero.png'
                    }}
                  />
                  <span
                    className={`catalog-status catalog-image-status ${
                      available ? '' : 'catalog-status-off'
                    }`}
                  >
                    {available ? 'Disponible' : 'No disponible'}
                  </span>
                </div>
                <div className="catalog-card-content">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <div className="catalog-meta">
                    <span>
                      <MapPin size={13} /> {item.sede}
                    </span>
                    <span>
                      <Users size={13} /> Hasta {item.capacity}
                    </span>
                  </div>
                  <div className="category-bottom">
                    <span>
                      {formatMoney(item.price)} / {category.unit}
                    </span>
                    {available && (
                      <span className="round-arrow">
                        <ArrowRight size={15} />
                      </span>
                    )}
                  </div>
                </div>
              </>
            )
            return available ? (
              <Link key={item.id} href={href} className="category-card">
                {card}
              </Link>
            ) : (
              <div
                key={item.id}
                className="category-card catalog-card-off"
                aria-disabled="true"
              >
                {card}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

