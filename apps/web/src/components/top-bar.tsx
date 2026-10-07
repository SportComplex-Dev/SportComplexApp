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

export function TopBar() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState(false)
  const { dark, toggleTheme } = useThemeToggle()

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const close = () => setOpenMenu(false)

  return (
    <header className="topbar sticky top-0 z-50 backdrop-blur-md">
      <div className="topbar-inner">
        <Link href="/" aria-label="Ir al inicio de AKROS SportComplex" onClick={close}>
          <Brand />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Navegación principal">
          {publicNav.map(({ label, href }) => (
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
          <Link href="/login" className="action-button nav-access">
            Accede al club <ArrowRight size={15} />
          </Link>
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
          {publicNav.map(({ label, href }) => (
            <Link key={href} href={href} onClick={close}>
              {label}
              <ArrowRight size={15} />
            </Link>
          ))}
          <Link href="/login" onClick={close} className="font-semibold">
            Accede al club
            <ArrowRight size={15} />
          </Link>
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
