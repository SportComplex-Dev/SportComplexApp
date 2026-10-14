'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { ChevronDown, LogOut } from 'lucide-react'
import { initials } from '@sportcomplex/core'
import { useApp } from '@/components/app-provider'

export function UserMenu({ variant = 'topbar' }: { variant?: 'topbar' | 'dark' | 'sidebar' }) {
  const { session, logout } = useApp()
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

  if (!session) return null
  const firstName = session.name.split(' ')[0]
  const badge = initials(session.name)

  return (
    <div className={`user-menu user-menu-${variant}`} ref={ref}>
      <motion.button
        type="button"
        whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
        className={variant === 'sidebar' ? 'admin-user' : 'profile-chip user-trigger'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menú de ${session.name}`}
        onClick={() => setOpen(!open)}
      >
        {variant === 'sidebar' ? (
          <>
            <span className="admin-avatar">{badge}</span>
            <span>
              <b>{session.name}</b>
              <small>{session.role}</small>
            </span>
          </>
        ) : (
          <>
            <span className="avatar">{badge}</span>
            <span className="user-name hidden lg:inline">{firstName}</span>
          </>
        )}
        <ChevronDown size={14} className={`user-chevron transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
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
              <b>{session.name}</b>
              <small>{session.email}</small>
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
