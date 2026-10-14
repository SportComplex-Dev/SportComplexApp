'use client'

import Link from 'next/link'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { formatMoney, minPrice, serviceCategories, type CatalogItem } from '@sportcomplex/core'
import { categoryIcons } from '@/components/category-icons'
import { IconBox } from '@/components/icon-box'

interface CategoryShowcaseProps {
  catalog: CatalogItem[]
}

export function CategoryShowcase({ catalog }: CategoryShowcaseProps) {
  const available = catalog.filter((item) => item.status === 'Disponible').length

  return (
    <>
      <div className="section-heading dashboard-heading">
        <div>
          <div className="eyebrow">HECHO PARA TI</div>
          <h2>
            ¿Qué hacemos <span>hoy?</span>
          </h2>
        </div>
        <span className="open-status">
          <i /> {available} espacios disponibles ahora
        </span>
      </div>

      <div className="dashboard-category-grid">
        {serviceCategories.map(({ slug, name, description, icon, tone, unit }) => {
          const from = minPrice(catalog, slug)
          return (
            <Link href={`/services/${slug}`} key={slug} className="dashboard-category">
              <IconBox icon={categoryIcons[icon]} tone={tone} />
              <span className="dash-card-arrow">
                <ArrowRight size={16} />
              </span>
              <h3>{name}</h3>
              <p>{description}</p>
              <div className="dashboard-price">
                {from ? (
                  <>
                    Desde {formatMoney(from)}
                    <span>/ {unit}</span>
                  </>
                ) : (
                  'Próximamente'
                )}
              </div>
            </Link>
          )
        })}
      </div>

      <div className="dashboard-bottom">
        <div className="dashboard-promo">
          <div className="promo-copy">
            <div className="eyebrow">ALTURA PARA TODOS</div>
            <h3>
              Activa tu energía.
              <br />
              Conoce nuestros espacios deportivos.
            </h3>
            <Link href="/services" className="text-link">
              Ver todos los servicios <ArrowRight size={15} />
            </Link>
          </div>
        </div>
        <div className="mini-tip">
          <IconBox icon={ShieldCheck} tone="lime" />
          <div>
            <b>Reserva con confianza</b>
            <p>Cambios o cancelaciones gratis hasta 4 horas antes.</p>
          </div>
        </div>
      </div>
    </>
  )
}
