'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Layers,
  LayoutDashboard,
  Moon,
  ShieldAlert,
  Sun,
  Users,
} from 'lucide-react'
import { Badge } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'

const adminNav = [
  { name: 'Catálogo & Aforos', href: '/admin/services', icon: Layers },
  { name: 'Panel Gerencial', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Empleados & Roles', href: '/admin/employees', icon: Users },
  { name: 'Contingencias', href: '/admin/incident', icon: ShieldAlert },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const isDark =
      document.documentElement.classList.contains('dark') ||
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

  return (
    <div className="club-app min-h-screen flex flex-col bg-[var(--surface)] text-app">
      {/* TopBar Administrativo */}
      <header className="topbar sticky top-0 z-50 backdrop-blur-md border-b border-[var(--line)]">
        <div className="topbar-inner">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Ir al inicio de AKROS">
              <Brand />
            </Link>
            <Badge variant="outline" className="border-brand-accent text-brand-accent font-bold text-[10px]">
              ADMIN CONSOLE
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-6" aria-label="Navegación administrativa">
            {adminNav.map(({ name, href, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link flex items-center gap-1.5 text-xs font-semibold ${
                    isActive ? 'nav-active text-brand-accent' : 'text-subtle'
                  }`}
                >
                  <Icon size={14} />
                  <span>{name}</span>
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="theme-toggle"
              aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              onClick={toggleTheme}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Link href="/" className="text-xs text-link flex items-center gap-1 font-semibold">
              <ArrowLeft size={13} /> Salir a la Web
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1">{children}</main>
    </div>
  )
}
