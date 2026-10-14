'use client'

import { motion } from 'motion/react'
import { Search } from 'lucide-react'
import type { CatalogItem } from '@sportcomplex/core'
import type { CustomCategory } from '../types'

interface CatalogFiltersProps {
  catalog: CatalogItem[]
  categories: CustomCategory[]
  selectedCategoryFilter: string
  setSelectedCategoryFilter: (cat: string) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  statusFilter: string
  setStatusFilter: (status: string) => void
}

export function CatalogFilters({
  catalog,
  categories,
  selectedCategoryFilter,
  setSelectedCategoryFilter,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
}: CatalogFiltersProps) {
  return (
    <section className="demo-card mb-6 p-4">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Pestañas de categoría (Tabs) */}
        <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Filtrar por categoría">
          <motion.button
            type="button"
            role="tab"
            aria-selected={selectedCategoryFilter === 'todas'}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategoryFilter === 'todas'
                ? 'bg-[var(--brand-accent)] text-[#111815] font-bold border-[var(--brand-accent)] shadow-xs'
                : 'bg-[var(--surface)] text-subtle border-[var(--line)] hover:text-ink hover:border-[var(--brand-accent)]/50'
            }`}
            onClick={() => setSelectedCategoryFilter('todas')}
          >
            Todas ({catalog.length})
          </motion.button>
          {categories.map((cat) => {
            const count = catalog.filter((c) => c.category === cat.slug).length
            return (
              <motion.button
                key={cat.slug}
                type="button"
                role="tab"
                aria-selected={selectedCategoryFilter === cat.slug}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className={`py-1.5 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  selectedCategoryFilter === cat.slug
                    ? 'bg-[var(--brand-accent)] text-[#111815] font-bold border-[var(--brand-accent)] shadow-xs'
                    : 'bg-[var(--surface)] text-subtle border-[var(--line)] hover:text-ink hover:border-[var(--brand-accent)]/50'
                }`}
                onClick={() => setSelectedCategoryFilter(cat.slug)}
              >
                {cat.name} ({count})
              </motion.button>
            )
          })}
        </div>

        {/* Buscador y filtro de estado */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar instancia o sede..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-ink outline-none focus:border-brand-accent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-ink outline-none focus:border-brand-accent"
          >
            <option value="todos">Todos los estados</option>
            <option value="Disponible">Disponibles</option>
            <option value="Mantenimiento">Mantenimiento</option>
          </select>
        </div>
      </div>
    </section>
  )
}
