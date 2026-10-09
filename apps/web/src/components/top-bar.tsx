'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, LogOut, Menu, Moon, Sun, X } from 'lucide-react'
import { Brand } from '@/components/brand'
import { ThemeToggle, useThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { useApp } from '@/components/app-provider'

export function TopBar() {
  const pathname = usePathname()
  const { session, ready, logout } = useApp()
  const [openMenu, setOpenMenu] = useState(false)
  const { dark, toggleTheme } = useThemeToggle()

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const close = () => setOpenMenu(false)

  const isCustomer = session && (session.role === 'Cliente' || session.role === 'customer')
  const isAdmin = session && (session.role === 'Administrador' || session.role === 'admin')

  const navItems = session
    ? isCustomer
      ? [
          { label: 'Inicio', href: '/' },
          { label: 'Servicios', href: '/services' },
          { label: 'Mi Portal', href: '/portal' },
          { label: 'Tiquetes QR', href: '/portal/tickets' },
        ]
      : isAdmin
      ? [
          { label: 'Panel Admin', href: '/admin/dashboard' },
          { label: 'Catálogo', href: '/admin/catalog' },
          { label: 'Portal Cliente', href: '/portal' },
        ]
      : [
          { label: 'Inicio', href: '/' },
          { label: 'Servicios', href: '/services' },
          { label: 'Mi Portal', href: '/portal' },
        ]
    : [
        { label: 'Inicio', href: '/' },
        { label: 'Servicios', href: '/services' },
        { label: 'Reglamentos', href: '/legal' },
      ]

  return (
    <header className="topbar sticky top-0 z-50 backdrop-blur-md">
      <div className="topbar-inner">
        <Link href="/" aria-label="Ir al inicio de AKROS SportComplex" onClick={close}>
          <Brand />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación principal">
          {navItems.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`nav-link ${isActive(href) ? 'nav-active' : ''}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle dark={dark} onToggle={toggleTheme} />
          <span className="topbar-action-divider" aria-hidden="true" />
          {ready && (session ? (
            <UserMenu />
          ) : (
            <Link href="/login" className="action-button nav-access">
              Accede al club <ArrowRight size={15} />
            </Link>
          ))}
          <button
            type="button"
            aria-label={openMenu ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={openMenu}
            className="mobile-menu md:hidden"
            onClick={() => setOpenMenu(!openMenu)}
          >
            {openMenu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {openMenu && (
        <div className="mobile-nav">
          {navItems.map(({ label, href }) => (
            <Link key={href} href={href} onClick={close}>
              {label}
              <ArrowRight size={15} />
            </Link>
          ))}
          {!session && (
            <Link href="/login" onClick={close} className="font-semibold">
              Accede al club
              <ArrowRight size={15} />
            </Link>
          )}
          <button
            type="button"
            className="mobile-theme-option"
            aria-pressed={dark}
            onClick={() => {
              toggleTheme()
              close()
            }}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          </button>
          {ready && session && (
            <button
              type="button"
              className="mobile-logout flex items-center justify-between py-3 text-red-500 font-medium"
              onClick={() => {
                close()
                logout()
              }}
            >
              Cerrar sesión <LogOut size={15} />
            </button>
          )}
        </div>
      )}
    </header>
  )
}

