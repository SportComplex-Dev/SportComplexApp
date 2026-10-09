'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

const listeners = new Map<string, Set<() => void>>()
const cache = new Map<string, { raw: string | null; value: unknown }>()

function read<T>(key: string, initial: T): T {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    /* almacenamiento no disponible */
  }
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value as T
  let value: T = initial
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = initial
    }
  }
  cache.set(key, { raw, value })
  return value
}

export function usePersistentState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const set = listeners.get(key) ?? new Set()
      set.add(callback)
      listeners.set(key, set)
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) callback()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        set.delete(callback)
        window.removeEventListener('storage', onStorage)
      }
    },
    [key]
  )

  const hydrated = useHydrated()
  const rawValue = useSyncExternalStore(
    subscribe,
    () => read(key, initial),
    () => initial
  )

  const setValue = useCallback(
    (next: T | ((previous: T) => T)) => {
      const previous = read(key, initial)
      const resolved = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next
      const raw = JSON.stringify(resolved)
      try {
        window.localStorage.setItem(key, raw)
      } catch {
        /* sin almacenamiento: el cambio no persiste */
      }
      cache.set(key, { raw, value: resolved })
      listeners.get(key)?.forEach((listener) => listener())
    },
    [key, initial]
  )

  return [hydrated ? rawValue : initial, setValue] as const
}

/** false durante el render del servidor y la hidratación inicial; true tras montar en el navegador. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}

/** Fecha de hoy (YYYY-MM-DD) tras montar en el navegador; cadena vacía en SSR. */
export function useToday(): string {
  const [today, setToday] = useState('')
  useEffect(() => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    setToday(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
  }, [])
  return today
}
