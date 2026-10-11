'use client'

import type { ComponentType } from 'react'
import {
  Dumbbell,
  BicepsFlexed,
  Layers,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react'
import {
  FaSoccerIcon,
  FaTennisBallIcon,
  FaPadelIcon,
  FaWaterLadderIcon,
  FaPersonSwimmingPoolIcon,
  FaGunSquirtIcon,
  FaHeatIcon,
  FaHotTubPersonIcon,
} from './custom-icons'

export type FilterIconProps = {
  size?: number
  strokeWidth?: number
  className?: string
}

export type FilterOption = {
  id: string
  label: string
  subtitle: string
  icon: ComponentType<FilterIconProps>
}

export const CATEGORY_FILTERS: Record<string, FilterOption[]> = {
  canchas: [
    { id: 'all', label: 'Todas', subtitle: 'Mostrar todo', icon: Layers },
    { id: 'futbol', label: 'Fútbol', subtitle: 'Césped sintético', icon: FaSoccerIcon },
    { id: 'tenis', label: 'Tenis', subtitle: 'Polvo de ladrillo', icon: FaTennisBallIcon },
    { id: 'padel', label: 'Pádel', subtitle: 'Panorámica cristal', icon: FaPadelIcon },
  ],
  piscinas: [
    { id: 'all', label: 'Todas', subtitle: 'Mostrar todo', icon: Waves },
    { id: 'adultos', label: 'Adultos', subtitle: 'Nado libre', icon: FaWaterLadderIcon },
    { id: 'entrenamiento', label: 'Entrenamiento', subtitle: 'Carril exclusivo', icon: FaPersonSwimmingPoolIcon },
    { id: 'ninos', label: 'Niños', subtitle: 'Zona infantil', icon: FaGunSquirtIcon },
  ],
  gimnasio: [
    { id: 'all', label: 'Todas', subtitle: 'Mostrar todo', icon: Dumbbell },
    { id: 'pesas', label: 'Pesas & Cardio', subtitle: 'Entrenamiento libre', icon: BicepsFlexed },
    { id: 'funcional', label: 'Funcional', subtitle: 'Fuerza y calistenia', icon: Zap },
  ],
  'zona-humeda': [
    { id: 'all', label: 'Todas', subtitle: 'Mostrar todo', icon: Sparkles },
    { id: 'sauna', label: 'Sauna', subtitle: 'Calor seco', icon: FaHeatIcon },
    { id: 'turco', label: 'Turco & Jacuzzi', subtitle: 'Vapor y agua caliente', icon: FaHotTubPersonIcon },
  ],
}

interface CategoryFiltersProps {
  categorySlug: string
  activeFilter: string
  onChange: (filterId: string) => void
}

export function CategoryFilters({ categorySlug, activeFilter, onChange }: CategoryFiltersProps) {
  const options = CATEGORY_FILTERS[categorySlug]
  if (!options || options.length <= 1) return null

  return (
    <div
      role="radiogroup"
      aria-label={`Filtrar servicios de ${categorySlug}`}
      className="flex items-center gap-2.5 overflow-x-auto py-2 my-2 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
    >
      {options.map((option) => {
        const isSelected = activeFilter === option.id
        const Icon = option.icon

        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isSelected}
            type="button"
            onClick={() => onChange(option.id)}
            className={`group inline-flex shrink-0 items-center gap-3.5 rounded-full pl-2 pr-5 py-2 text-left transition-all duration-200 select-none cursor-pointer active:scale-[0.98] ${
              isSelected
                ? 'bg-[#123e30] text-white shadow-md shadow-[#123e30]/15 ring-1 ring-[#123e30] dark:bg-[#c9ef75] dark:text-[#123e30] dark:ring-[#c9ef75] dark:shadow-[#c9ef75]/10'
                : 'bg-white/95 text-[#17231e] border border-[#e7eae4] hover:border-[#ccd3c8] hover:bg-[#fafbf9] shadow-xs dark:bg-[#18231e] dark:border-[#2b3a33] dark:text-neutral-100 dark:hover:bg-[#202d27]'
            }`}
          >
            {/* Badge circular con icono */}
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full transition-colors ${
                isSelected
                  ? 'bg-white text-[#123e30] dark:bg-[#123e30] dark:text-[#c9ef75]'
                  : 'bg-[#f1f4ec] text-[#42554a] group-hover:bg-[#e7ecdf] dark:bg-[#24332c] dark:text-[#b4c9b9]'
              }`}
            >
              <Icon size={17} strokeWidth={isSelected ? 2.5 : 2} />
            </span>

            {/* Texto en dos líneas */}
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-bold tracking-tight">
                {option.label}
              </span>
              <span
                className={`text-[10.5px] font-medium transition-opacity ${
                  isSelected
                    ? 'text-white/75 dark:text-[#123e30]/80'
                    : 'text-[#748079] dark:text-neutral-400'
                }`}
              >
                {option.subtitle}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
