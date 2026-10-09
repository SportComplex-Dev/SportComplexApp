'use client'

import {
  initialCatalog,
  type CatalogItem,
  type Booking,
} from '@sportcomplex/core'
import { usePersistentState } from '@/lib/persistent-state'

/**
 * @deprecated El catálogo de administración ahora persiste directamente contra la base de datos relacional
 * mediante los endpoints /api/admin/services y /api/admin/services/categories (TSK-FE-04, TSK-FE-05).
 * Se mantiene este hook exclusivamente para retrocompatibilidad con componentes locales legacy.
 */
export const useCatalog = () => usePersistentState<CatalogItem[]>('altura:catalog', initialCatalog)

export type { Booking }

export const initialBookings: Booking[] = [
  { id: 'b1', code: 'ALT-2909-1837', client: 'María Camila Restrepo', category: 'canchas', service: 'Cancha de tenis · Cancha 2', sede: 'Poblado', date: '2026-10-02', time: '6:30 p. m.', attendees: 1, amount: 48000, status: 'Confirmada' },
  { id: 'b2', code: 'ALT-2809-1044', client: 'María Camila Restrepo', category: 'piscinas', service: 'Piscina · Nado libre', sede: 'Laureles', date: '2026-09-28', time: '10:00 a. m.', attendees: 1, amount: 22000, status: 'Usada' },
  { id: 'b3', code: 'ALT-2909-2210', client: 'Juan Pablo Gómez', category: 'piscinas', service: 'Piscina · Nado libre', sede: 'Laureles', date: '2026-10-02', time: '6:15 p. m.', attendees: 1, amount: 22000, status: 'Confirmada' },
  { id: 'b4', code: 'ALT-2909-3057', client: 'Sofía López Mejía', category: 'canchas', service: 'Fútbol 5 · Cancha 2', sede: 'Laureles', date: '2026-10-02', time: '5:30 p. m.', attendees: 1, amount: 95000, status: 'Pendiente' },
  { id: 'b5', code: 'ALT-2909-4412', client: 'Daniel Vélez Castro', category: 'gimnasio', service: 'Gimnasio · Sesión individual', sede: 'Laureles', date: '2026-10-02', time: '5:00 p. m.', attendees: 1, amount: 18000, status: 'Confirmada' },
]

export const useBookings = () => usePersistentState<Booking[]>('altura:bookings', initialBookings)

export type Draft = { itemId: string; date: string; time: string; attendees: number }
export const useDraft = () => usePersistentState<Draft | null>('altura:draft', null)

/** Código del último tiquete generado, para mostrar la confirmación. */
export const useLastCode = () => usePersistentState<string | null>('altura:last-code', null)

export type Session = {
  name: string
  email: string
  role: string
}

export const sampleAccounts: Session[] = [
  { name: 'Sebastián Mendoza', email: 'admin@sportcomplex.co', role: 'Administrador' },
  { name: 'Catalina Ríos', email: 'catalina@altura.co', role: 'Administrador' },
  { name: 'Andrés Muñoz', email: 'andres@altura.co', role: 'Empleado_Vendedor' },
  { name: 'Laura Pérez', email: 'laura@altura.co', role: 'Cliente' },
]

export const useStoredSession = () => usePersistentState<Session | null>('altura:session', sampleAccounts[0])

export const defaultSettings = { businessName: 'Altura Club', businessHours: '06:00 a. m. — 10:00 p. m.', bookingsOpen: true }
export const useSettings = () => usePersistentState('altura:settings', defaultSettings)
