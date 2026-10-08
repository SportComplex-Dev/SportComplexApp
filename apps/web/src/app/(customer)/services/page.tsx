'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { formatMoney, minPrice, serviceCategories } from '@sportcomplex/core'
import { categoryIcons } from '@/components/category-icons'
import { IconBox } from '@/components/icon-box'
import { PageHeading } from '@/components/page-heading'
import { useCatalog } from '@/lib/stores'

export default function ServicesPage() {
  const [catalog] = useCatalog()
  return <main className="section-shell app-page">
    <PageHeading eyebrow="NUESTROS SERVICIOS" title="¿Qué te gustaría hacer?" description="Elige una categoría para ver todos los espacios disponibles." />
    <div className="dashboard-category-grid">{serviceCategories.map(({ slug, name, description, icon, tone, unit }) => {
      const from = minPrice(catalog, slug)
      return <Link href={`/services/${slug}`} key={slug} className="dashboard-category"><IconBox icon={categoryIcons[icon]} tone={tone} /><span className="dash-card-arrow"><ArrowRight size={16} /></span><h3>{name}</h3><p>{description}</p><div className="dashboard-price">{from ? <>Desde {formatMoney(from)}<span>/ {unit}</span></> : 'Próximamente'}</div></Link>
    })}</div>
  </main>
}
