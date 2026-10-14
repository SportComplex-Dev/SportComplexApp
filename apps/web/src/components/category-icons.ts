import { Dumbbell, Footprints, Sparkles, Waves, type LucideIcon } from 'lucide-react'
import type { CategoryIcon } from '@sportcomplex/core'

export const categoryIcons: Record<CategoryIcon, LucideIcon> = {
  court: Footprints,
  pool: Waves,
  gym: Dumbbell,
  wellness: Sparkles,
}
