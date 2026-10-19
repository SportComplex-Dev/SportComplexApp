import type { CatalogItem, OperatingScheduleConfig } from '@sportcomplex/core'

export interface CustomCategory {
  id?: number
  slug: string
  name: string
  unit: string
  tipo?: 'CANCHA' | 'PISCINA' | 'GIMNASIO' | 'ZONA_HUMEDA'
  description?: string
}

export interface DbFranjaHoraria {
  id?: number
  servicioId?: number
  diaSemana: number
  horaInicio: string | Date
  horaFin: string | Date
}

export interface DbCategory {
  id: number
  nombre: string
  tipo: string
  description?: string
}

export interface DbService {
  id: number
  nombre: string
  categoriaId: number
  capacidadMaxima: number
  tarifa: number | string
  modalidad: 'EXCLUSIVA' | 'AFORO'
  tipoPiscina?: 'PUBLICA' | 'PRIVADA' | null
  estado: 'ACTIVO' | 'INHABILITADO'
  description?: string
  franjasHorarias?: DbFranjaHoraria[]
  categoria?: DbCategory
}

export const blankCatalogItem: CatalogItem = {
  id: '',
  category: 'canchas',
  name: '',
  description: '',
  price: 0,
  sede: 'Poblado',
  capacity: 1,
  status: 'Disponible',
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function mapDbCategory(c: { id: number; nombre: string; tipo: string; description?: string }): CustomCategory {
  const slug = slugify(c.nombre)
  let unit = 'hora'
  if (c.tipo === 'GIMNASIO') unit = 'sesión'
  else if (c.tipo === 'ZONA_HUMEDA') unit = 'acceso'
  else if (c.tipo === 'PISCINA') unit = 'hora'

  return {
    id: c.id,
    slug: slug || String(c.id),
    name: c.nombre,
    unit,
    tipo: c.tipo as CustomCategory['tipo'],
    description: c.description || `Instalaciones de ${c.nombre}`,
  }
}

export function parseHour(timeValue: string | Date | unknown): number {
  if (typeof timeValue === 'string') {
    const parts = timeValue.split(':')
    return parseInt(parts[0], 10) || 0
  }
  if (timeValue instanceof Date) {
    return timeValue.getUTCHours()
  }
  return 6
}

export function mapDbService(s: DbService, categoriesList: CustomCategory[]): CatalogItem {
  const cat = categoriesList.find((c) => c.id === s.categoriaId)
  const catSlug = (cat?.slug || 'canchas') as CatalogItem['category']

  return {
    id: String(s.id),
    name: s.nombre,
    category: catSlug,
    sede: 'Poblado',
    description: s.description || (s.tipoPiscina ? `Piscina ${s.tipoPiscina.toLowerCase()}` : `Instalación deportiva oficial`),
    price: Number(s.tarifa) || 0,
    capacity: s.capacidadMaxima || 1,
    status: s.estado === 'ACTIVO' ? 'Disponible' : 'Mantenimiento',
    poolType: s.tipoPiscina ? (s.tipoPiscina as 'PUBLICA' | 'PRIVADA') : undefined,
  }
}

export function mapDbSchedule(s: DbService, categoriesList: CustomCategory[]): OperatingScheduleConfig {
  const cat = categoriesList.find((c) => c.id === s.categoriaId)
  const catSlug = (cat?.slug || 'canchas') as CatalogItem['category']
  const isShared = s.modalidad === 'AFORO' || cat?.tipo === 'GIMNASIO' || cat?.tipo === 'PISCINA'
  const capacity = s.capacidadMaxima > 0 ? s.capacidadMaxima : isShared ? 25 : 4

  const disabledSlots: string[] = []
  if (Array.isArray(s.franjasHorarias) && s.franjasHorarias.length > 0) {
    const activeHours = new Set<number>()
    s.franjasHorarias.forEach((f) => {
      const h = parseHour(f.horaInicio)
      activeHours.add(h)
    })
    for (let h = 6; h < 22; h++) {
      if (!activeHours.has(h)) {
        disabledSlots.push(`${String(h).padStart(2, '0')}:00`)
      }
    }
  }

  return {
    serviceId: String(s.id),
    serviceName: s.nombre,
    categorySlug: catSlug,
    capacity,
    isShared,
    startHour: 6,
    endHour: 22,
    slotDurationMinutes: 60,
    disabledSlots,
  }
}
