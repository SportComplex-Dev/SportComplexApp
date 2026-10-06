'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react'
import { Brand } from '@/components/brand'

const publicNav = [
  { label: 'Inicio', href: '/' },
  { label: 'Servicios e Instalaciones', href: '/portal/book' },
  { label: 'Reglamentos', href: '/legal' },
]

export function TopBar() {
  const pathname = usePathname()
  const [openMenu, setOpenMenu] = useState(false)
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark') ||
      localStorage.getItem('akros_theme') === 'dark'
    setDark(isDark)
    if (isDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleTheme = () => {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('akros_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('akros_theme', 'light')
    }
  }

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
          <button
            type="button"
            className="theme-toggle"
            aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            onClick={toggleTheme}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className="topbar-action-divider" aria-hidden="true" />
          <Link href="/login" className="nav-login hidden md:inline-flex items-center gap-1.5 px-2">
            Iniciar sesión
          </Link>
          <Link href="/register" className="action-button nav-access">
            Crear cuenta <ArrowRight size={15} />
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
          <Link href="/login" onClick={close}>
            Iniciar sesión
            <ArrowRight size={15} />
          </Link>
          <Link href="/register" onClick={close}>
            Crear cuenta de socio
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
