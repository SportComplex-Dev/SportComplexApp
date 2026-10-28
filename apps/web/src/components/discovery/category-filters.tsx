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
} from '@/components/brand/custom-icons'

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
      className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 my-3 w-full"
    >
      {options.map((option, index) => {
        const isSelected = activeFilter === option.id
        const Icon = option.icon
        const isOddLast = options.length % 2 !== 0 && index === options.length - 1

        return (
          <button
            key={option.id}
            role="radio"
            aria-checked={isSelected}
            type="button"
            onClick={() => onChange(option.id)}
            className={`group flex items-center gap-2.5 sm:gap-3.5 rounded-2xl sm:rounded-full px-2.5 py-2 sm:pl-2 sm:pr-5 text-left transition-all duration-200 select-none cursor-pointer active:scale-[0.98] min-w-0 ${
              isOddLast ? 'col-span-2 sm:col-span-1' : ''
            } ${
              isSelected
                ? 'bg-[#123e30] text-white shadow-md shadow-[#123e30]/15 ring-1 ring-[#123e30] dark:bg-[#c9ef75] dark:text-[#123e30] dark:ring-[#c9ef75] dark:shadow-[#c9ef75]/10'
                : 'bg-white/95 text-[#17231e] border border-[#e7eae4] hover:border-[#ccd3c8] hover:bg-[#fafbf9] shadow-xs dark:bg-[#18231e] dark:border-[#2b3a33] dark:text-neutral-100 dark:hover:bg-[#202d27]'
            }`}
          >
            {/* Badge circular con icono */}
            <span
              className={`grid size-8 sm:size-9 shrink-0 place-items-center rounded-full transition-colors ${
                isSelected
                  ? 'bg-white text-[#123e30] dark:bg-[#123e30] dark:text-[#c9ef75]'
                  : 'bg-[#f1f4ec] text-[#42554a] group-hover:bg-[#e7ecdf] dark:bg-[#24332c] dark:text-[#b4c9b9]'
              }`}
            >
              <Icon size={16} strokeWidth={isSelected ? 2.5 : 2} />
            </span>

            {/* Texto en dos líneas */}
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-[12.5px] sm:text-[13px] font-bold tracking-tight truncate">
                {option.label}
              </span>
              <span
                className={`text-[10px] sm:text-[10.5px] font-medium transition-opacity truncate ${
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
