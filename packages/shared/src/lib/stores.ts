'use client'

import type { Booking } from '@sportcomplex/core'
import { usePersistentState } from './persistent-state'

export type { Booking }

/**
 * Información del borrador de reserva en progreso (borradorReserva).
 */
export type Draft = {
  itemId: string
  date: string
  time: string
  attendees: number
  /**
   * Epoch timestamp en milisegundos (`Date.now()`) indicando el momento exacto en que expira la retención del cupo (TSK-FE-09).
   */
  expiresAt?: number
}
export const useDraft = () => usePersistentState<Draft | null>('altura:draft', null)

/** Código del último tiquete generado, para mostrar la confirmación. */
export const useLastCode = () => usePersistentState<string | null>('altura:last-code', null)

export type Session = {
  name: string
  email: string
  role: string
}
