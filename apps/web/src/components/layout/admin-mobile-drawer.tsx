'use client'

import React, { useEffect, useRef } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import { Brand } from '@/components/brand/brand'
import { UserMenu } from '@/components/layout/user-menu'

export interface AdminNavItem {
  name: string
  icon: LucideIcon
  href: string
}

export interface AdminMobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  navigation: AdminNavItem[]
  pathname: string
  pending?: number
  onNotify?: (message: string) => void
}

export function AdminMobileDrawer({
  isOpen,
  onClose,
  navigation,
  pathname,
  pending = 0,
  onNotify,
}: AdminMobileDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const prevPathnameRef = useRef(pathname)

  // Cerrar automáticamente cuando cambia la ruta (pathname)
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      onClose()
    }
  }, [pathname, onClose])

  // Bloquear scroll en el body mientras el drawer esté abierto
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      closeButtonRef.current?.focus()
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      id="admin-mobile-drawer"
      className="admin-drawer-portal fixed inset-0 z-50 md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Menú de administración"
      ref={drawerRef}
    >
      {/* Backdrop con desenfoque suave y soporte para clic de cierre */}
      <div
        className="admin-drawer-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
        aria-hidden="true"
        onClick={onClose}
        data-testid="admin-drawer-backdrop"
      />

      {/* Contenedor del Drawer deslizante */}
      <div className="admin-drawer fixed inset-y-0 left-0 z-50 flex w-[285px] max-w-[85vw] flex-col overflow-y-auto bg-white p-5 shadow-2xl transition-transform duration-300 ease-out dark:bg-[#17211c] dark:border-r dark:border-[#27352d]">
        {/* Cabecera del Drawer */}
        <div className="admin-drawer-header flex items-center justify-between pb-4 border-b border-[#edf0eb] dark:border-[#27352d]">
          <div className="flex items-center gap-2">
            <Link href="/admin" onClick={onClose} aria-label="Ir al resumen">
              <Brand />
            </Link>
            <Badge variant="admin">ADMIN</Badge>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="admin-icon-button flex h-9 w-9 items-center justify-center rounded-lg border border-[#e9ede8] bg-white text-[#647268] hover:bg-[#f5f7f3] dark:bg-[#151e19] dark:border-[#35443a] dark:text-[#aab8ad]"
            aria-label="Cerrar menú de navegación"
            onClick={onClose}
            data-testid="admin-drawer-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Espacio de trabajo */}
        <div className="admin-workspace py-3 border-b border-[#edf0eb] dark:border-[#27352d]">
          <span className="block text-[11px] font-extrabold tracking-wider text-[#9aa49c] dark:text-[#7d8b80] mb-1">
            ESPACIO DE TRABAJO
          </span>
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left"
            onClick={() => onNotify?.('Altura Club · Medellín, Colombia')}
          >
            <span className="workspace-icon grid h-7 w-7 place-items-center rounded-md border border-[#e2e8df] bg-[#f2f6ec] text-[11px] font-bold text-[#527148] dark:border-[#35443a] dark:bg-[#1c2920] dark:text-[#c9ef75]">
              A
            </span>
            <span className="flex-1 text-[13px] font-semibold text-[#27352c] dark:text-[#eef3eb]">
              Altura Club
              <small className="block text-[11px] font-normal text-[#929d95] dark:text-[#89958c]">
                Medellín, Colombia
              </small>
            </span>
            <ChevronDown size={14} className="text-[#879289]" />
          </button>
        </div>

        {/* Navegación */}
        <nav className="admin-nav flex flex-col gap-1 py-4" aria-label="Navegación de administración móvil">
          <span className="admin-nav-label text-[11px] font-extrabold tracking-widest text-[#a0aaa1] px-2 mb-1 dark:text-[#7d8b80]">
            GESTIÓN
          </span>
          {navigation.map(({ name, icon: Icon, href }) => {
            const isCurrent =
              pathname === href ||
              (href === '/admin' && pathname === '/admin/dashboard') ||
              (href === '/admin/catalog' && pathname === '/admin/services')
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-[13px] transition-colors ${
                  isCurrent
                    ? 'bg-[#eff4e9] font-bold text-[#355a38] dark:bg-[rgba(201,239,117,0.12)] dark:text-[#c9ef75]'
                    : 'text-[#68766c] hover:bg-[#f5f7f3] hover:text-[#263a2c] dark:text-[#aab8ad] dark:hover:bg-[#1f2c24] dark:hover:text-[#f7f8f5]'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{name}</span>
                {name === 'Reservas' && pending > 0 && (
                  <i className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#e9eee5] text-[11px] font-semibold not-italic text-[#667662] dark:bg-[#25362a] dark:text-[#c9ef75]">
                    {pending}
                  </i>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Pie del Drawer */}
        <div className="admin-drawer-footer mt-auto pt-4 border-t border-[#edf0eb] dark:border-[#27352d]">
          <div className="admin-help mb-3 rounded-xl border border-[#e9ede6] bg-[#fbfcfa] p-3 dark:border-[#27352d] dark:bg-[#151e19]">
            <span className="admin-help-icon text-[#81996b] dark:text-[#c9ef75]">
              <ShieldCheck size={16} />
            </span>
            <b className="mt-1 block text-[12px] text-[#27352c] dark:text-[#eef3eb]">¿Necesitas ayuda?</b>
            <small className="block text-[11px] text-[#89948b] dark:text-[#9eada1] mb-2">
              Consulta nuestro centro de soporte.
            </small>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] font-semibold text-[#50754c] dark:text-[#c9ef75]"
              onClick={() => onNotify?.('El centro de soporte estará disponible pronto.')}
            >
              Ir al soporte <ArrowRight size={13} />
            </button>
          </div>
          <UserMenu variant="sidebar" />
        </div>
      </div>
    </div>
  )
}
