'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { usePersistentState, useHydrated } from '@/lib/persistent-state'
import { sampleAccounts, useStoredSession, type Session } from '@/lib/stores'
import type { ToastKind } from '@/components/toast-message'

type AppContextValue = {
  session: Session | null
  ready: boolean
  login: (email: string, name?: string) => Session
  logout: () => void
  notify: (message: string, kind?: ToastKind) => void
  toast: { message: string; kind: ToastKind }
  closeToast: () => void
  dark: boolean
  setDark: (value: boolean) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro de AppProvider')
  return context
}

export function AppProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated()
  const [session, setSession] = useStoredSession()
  const [dark, setDarkState] = usePersistentState<boolean>('altura:dark', false)
  const [toast, setToast] = useState<{ message: string; kind: ToastKind }>({ message: '', kind: 'info' })
  const timer = useRef<number | undefined>(undefined)

  const setDark = useCallback(
    (value: boolean) => {
      setDarkState(value)
      if (value) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    },
    [setDarkState]
  )

  const closeToast = useCallback(() => setToast((current) => ({ ...current, message: '' })), [])
  const notify = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      setToast({ message, kind })
      if (typeof window !== 'undefined') {
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(closeToast, 3600)
      }
    },
    [closeToast]
  )

  const login = useCallback(
    (email: string, name?: string) => {
      const normalized = email.trim().toLowerCase()
      const known = sampleAccounts.find((account) => account.email.toLowerCase() === normalized)
      const next: Session = known ?? {
        name: name?.trim() || 'Administrador',
        email: normalized,
        role: 'Administrador',
      }
      setSession(next)
      notify(`Bienvenido, ${next.name}`, 'success')
      return next
    },
    [notify, setSession]
  )

  const logout = useCallback(() => {
    setSession(null)
    notify('Has cerrado sesión.')
  }, [notify, setSession])

  return (
    <AppContext.Provider
      value={{
        session: session ?? sampleAccounts[0],
        ready,
        login,
        logout,
        notify,
        toast,
        closeToast,
        dark,
        setDark,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
