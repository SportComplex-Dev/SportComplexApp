'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react'
import { Brand } from '@/components/brand'
import { ThemeToggle, useThemeToggle } from '@/components/theme-toggle'

const publicNav = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios e Instalaciones', href: '/portal/book' },
  { label: 'Reglamentos', href: '/legal' },
]

const customerNav = [
  { label: 'Inicio', href: '/portal' },
  { label: 'Servicios', href: '/portal/book' },
  { label: 'Mi cuenta', href: '/portal/membership' },
  { label: 'Tiquetes', href: '/portal/tickets' },
]

export function TopBar({
  customer,
}: {
  customer?: { name: string; email: string }
}) {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState(false)
  const { dark, toggleTheme } = useThemeToggle()

  const navigation = customer ? customerNav : publicNav
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const close = () => setOpenMenu(false)
  const customerLabel = customer?.name || customer?.email || ''
  const customerInitials = customerLabel
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <header className="topbar sticky top-0 z-50 backdrop-blur-md">
      <div className="topbar-inner">
        <Link href="/" aria-label="Ir al inicio de AKROS SportComplex" onClick={close}>
          <Brand />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación principal">
          {navigation.map(({ label, href }) => (
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
          {customer ? (
            <div className="profile-chip" aria-label={`Sesión de ${customerLabel}`}>
              <span className="avatar" aria-hidden="true">{customerInitials}</span>
              <span className="hidden max-w-32 truncate sm:inline">{customerLabel}</span>
            </div>
          ) : (
            <Link href="/login" className="action-button nav-access">
              Accede al club <ArrowRight size={15} />
            </Link>
          )}
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
          {navigation.map(({ label, href }) => (
            <Link key={href} href={href} onClick={close}>
              {label}
              <ArrowRight size={15} />
            </Link>
          ))}
          {customer ? (
            <p className="py-3 text-sm font-semibold">{customerLabel}</p>
          ) : (
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
        </div>
      )}
    </header>
  )
}
