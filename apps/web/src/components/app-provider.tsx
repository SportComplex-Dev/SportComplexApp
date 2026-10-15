'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { SessionProvider, useSession, signOut } from 'next-auth/react'
import { usePersistentState, useHydrated } from '@sportcomplex/shared/lib'
import { type Session } from '@sportcomplex/shared/lib'
import { normalizeRole } from '@/lib/session'
import type { ToastKind } from '@/components/toast-message'

type AppContextValue = {
  session: Session | null
  ready: boolean
  login: (email: string, name?: string, role?: string) => Session
  logout: () => void | Promise<void>
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

export function useOptionalApp() {
  return useContext(AppContext)
}

function InnerAppProvider({ children }: { children: ReactNode }) {
  const ready = useHydrated()
  const { data: authSession } = useSession()
  const [dark, setDarkState] = usePersistentState<boolean>('akros_theme_dark', false)
  const [toast, setToast] = useState<{ message: string; kind: ToastKind }>({ message: '', kind: 'info' })
  const timer = useRef<number | undefined>(undefined)

  const session = useMemo<Session | null>(() => {
    if (authSession?.user) {
      const userRole = (authSession.user as { role?: string }).role
      const canonical = normalizeRole(userRole) ?? 'Cliente'
      return {
        name: authSession.user.name || 'Cliente',
        email: authSession.user.email || '',
        role: canonical,
      }
    }
    return null
  }, [authSession])

  useEffect(() => {
    if (ready && typeof document !== 'undefined') {
      const isDark = Boolean(dark)
      document.documentElement.classList.toggle('dark', isDark)
      document.querySelector('.club-app')?.classList.toggle('dark', isDark)
      try {
        localStorage.setItem('akros_theme', isDark ? 'dark' : 'light')
      } catch {}
    }
  }, [ready, dark])

  const setDark = useCallback(
    (value: boolean) => {
      setDarkState(value)
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', value)
        document.querySelector('.club-app')?.classList.toggle('dark', value)
        try {
          localStorage.setItem('akros_theme', value ? 'dark' : 'light')
        } catch {}
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
    (email: string, name?: string, role?: string) => {
      const normalized = email.trim().toLowerCase()
      const canonicalRole = role ? (normalizeRole(role) ?? 'Cliente') : 'Cliente'
      const next: Session = {
        name: name?.trim() || 'Cliente',
        email: normalized,
        role: canonicalRole,
      }
      notify(`Bienvenido, ${next.name}`, 'success')
      return next
    },
    [notify]
  )

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      await signOut({ redirect: false })
    } catch {
      // Ignorar fallos de red al cerrar sesión
    } finally {
      notify('Has cerrado sesión.')
      if (typeof window !== 'undefined') {
        window.location.assign('/')
      }
    }
  }, [notify])

  return (
    <AppContext.Provider
      value={{
        session,
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

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <InnerAppProvider>{children}</InnerAppProvider>
    </SessionProvider>
  )
}
