'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ChevronDown, LogOut } from 'lucide-react'
import { initials } from '@sportcomplex/core'
import { useOptionalApp } from '@/components/layout/app-provider'

import type { Session } from '@sportcomplex/shared/lib'

export function UserMenu({
  variant = 'topbar',
}: {
  variant?: 'topbar' | 'dark' | 'sidebar' | 'admin-topbar'
}) {
  const app = useOptionalApp()
  const session = app?.session ?? null
  const logout = app?.logout ?? (() => {})
  const [open, setOpen] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // En la vista de administración (sidebar o admin-topbar), garantizar una sesión de respaldo
  // para que el menú de usuario y la opción de cerrar sesión siempre estén disponibles
  const currentSession: Session | null =
    session ??
    (variant === 'sidebar' || variant === 'admin-topbar'
      ? {
          name: 'Administrador',
          email: 'admin@sportcomplex.com',
          role: 'Administrador',
        }
      : null)

  if (!currentSession) return null
  const firstName = currentSession.name.split(' ')[0]
  const badge = initials(currentSession.name)

  return (
    <div className={`user-menu user-menu-${variant}`} ref={ref}>
      <motion.button
        type="button"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        className={
          variant === 'sidebar'
            ? 'admin-user'
            : variant === 'admin-topbar'
              ? 'admin-avatar cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#8aaa59]'
              : 'profile-chip user-trigger'
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${currentSession.name}`}
        onClick={() => setOpen(!open)}
        data-testid={variant === 'admin-topbar' ? 'admin-topbar-user-menu' : undefined}
      >
        {variant === 'sidebar' ? (
          <>
            <span className="admin-avatar">{badge}</span>
            <span>
              <b>{currentSession.name}</b>
              <small>{currentSession.role}</small>
            </span>
            <ChevronDown size={14} className={`user-chevron transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        ) : variant === 'admin-topbar' ? (
          badge
        ) : (
          <>
            <span className="avatar">{badge}</span>
            <span className="user-name hidden lg:inline">{firstName}</span>
            <ChevronDown size={14} className={`user-chevron transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            className="user-dropdown"
          >
            <div className="user-dropdown-head">
              <b>{currentSession.name}</b>
              <small>{currentSession.email}</small>
            </div>
            <button
              role="menuitem"
              type="button"
              className="user-logout"
              onClick={() => {
                setOpen(false)
                logout()
              }}
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
