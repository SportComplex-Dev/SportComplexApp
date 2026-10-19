'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Ticket,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { Brand } from '@/components/brand/brand'
import { UserMenu } from '@/components/layout/user-menu'
import { useApp } from '@/components/layout/app-provider'
import { useToday } from '@sportcomplex/shared/lib'
import { ToastMessage } from '@/components/feedback/toast-message'
import { AdminMobileDrawer } from '@/components/layout/admin-mobile-drawer'

const navigation: { name: string; icon: LucideIcon; href: string }[] = [
  { name: 'Resumen', icon: Home, href: '/admin' },
  { name: 'Catálogo', icon: Ticket, href: '/admin/catalog' },
  { name: 'Torneos', icon: Trophy, href: '/admin/tournaments' },
  { name: 'Empleados', icon: Users, href: '/admin/employees' },
  { name: 'Reservas', icon: CalendarDays, href: '/admin/bookings' },
  { name: 'Contingencias', icon: AlertTriangle, href: '/admin/incident' },
  { name: 'Membresías', icon: BadgeCheck, href: '/admin/memberships' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { notify, toast, closeToast, dark, setDark, logout } = useApp()
  const today = useToday()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const handleOpenDrawer = useCallback(() => setIsDrawerOpen(true), [])
  const handleCloseDrawer = useCallback(() => setIsDrawerOpen(false), [])

  const active =
    navigation.find(
      (item) =>
        pathname === item.href ||
        (item.href === '/admin' && pathname === '/admin/dashboard') ||
        (item.href !== '/admin' && pathname.startsWith(item.href))
    )?.name ?? 'Resumen'
  const pending = 0

  return (
    <main className={`admin-shell club-app ${dark ? 'dark' : ''}`}>
      <aside className="admin-sidebar hidden md:flex">
        <div className="admin-brand">
          <Link href="/admin" aria-label="Ir al resumen">
            <Brand />
          </Link>
          <Badge variant="admin">ADMIN</Badge>
        </div>
        <div className="admin-workspace">
          <span>ESPACIO DE TRABAJO</span>
          <button type="button" onClick={() => notify('Altura Club · Medellín, Colombia')}>
            <span className="workspace-icon">A</span>
            <span>
              Altura Club<small>Medellín, Colombia</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
        <nav className="admin-nav" aria-label="Menú de administración">
          <span className="admin-nav-label">GESTIÓN</span>
          {navigation.map(({ name, icon: Icon, href }) => {
            const isCurrent =
              pathname === href ||
              (href === '/admin' && pathname === '/admin/dashboard') ||
              (href === '/admin/catalog' && pathname === '/admin/services') ||
              (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} className={isCurrent ? 'admin-nav-active' : ''}>
                <Icon size={17} />
                {name}
                {name === 'Reservas' && pending > 0 && <i>{pending}</i>}
              </Link>
            )
          })}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-help">
            <span className="admin-help-icon">
              <ShieldCheck size={17} />
            </span>
            <b>¿Necesitas ayuda?</b>
            <small>Consulta nuestro centro de soporte.</small>
            <button type="button" onClick={() => notify('El centro de soporte estará disponible pronto.')}>
              Ir al soporte <ArrowRight size={13} />
            </button>
          </div>
          <UserMenu variant="sidebar" />
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="admin-icon-button admin-menu-trigger md:hidden"
              aria-label="Abrir menú de navegación"
              aria-expanded={isDrawerOpen}
              aria-controls="admin-mobile-drawer"
              onClick={handleOpenDrawer}
              data-testid="admin-mobile-menu-trigger"
            >
              <Menu size={18} />
            </button>
            <div className="admin-crumb">
              <span>Altura Club</span>
              <ChevronRight size={14} />
              <b>{active}</b>
            </div>
          </div>
          <div className="admin-top-actions">
            <span className="admin-today hidden sm:inline-flex">
              <CalendarDays size={14} />{' '}
              {today ? formatDate(today, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
            </span>
            <button
              type="button"
              className="admin-icon-button"
              aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="admin-icon-button"
              aria-label="Buscar"
              onClick={() => notify('La búsqueda estará disponible pronto.')}
            >
              <Search size={17} />
            </button>
            <button
              type="button"
              className="admin-icon-button notification-button"
              aria-label="Notificaciones"
              onClick={() => notify('No tienes notificaciones nuevas')}
            >
              <Activity size={17} />
              <i />
            </button>
            <button
              type="button"
              className="admin-icon-button logout-button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={() => logout()}
              data-testid="admin-topbar-logout-button"
            >
              <LogOut size={17} />
            </button>
            <UserMenu variant="admin-topbar" />
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </section>

      <AdminMobileDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        navigation={navigation}
        pathname={pathname}
        pending={pending}
        onNotify={notify}
      />

      <ToastMessage message={toast.message} kind={toast.kind} close={closeToast} />
    </main>
  )
}
