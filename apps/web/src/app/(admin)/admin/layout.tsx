'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Home,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@sportcomplex/core'
import { Badge } from '@sportcomplex/ui'
import { Brand } from '@/components/brand'
import { UserMenu } from '@/components/user-menu'
import { useApp } from '@/components/app-provider'
import { useBookings } from '@/lib/stores'
import { useToday } from '@/lib/persistent-state'
import { ToastMessage } from '@/components/toast-message'

const navigation: { name: string; icon: LucideIcon; href: string }[] = [
  { name: 'Resumen', icon: Home, href: '/admin' },
  { name: 'Catálogo', icon: Ticket, href: '/admin/catalog' },
  { name: 'Empleados', icon: Users, href: '/admin/employees' },
  { name: 'Reservas', icon: CalendarDays, href: '/admin/bookings' },
  { name: 'Membresías', icon: BadgeCheck, href: '/admin/memberships' },
  { name: 'Configuración', icon: Activity, href: '/admin/settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { session, notify, toast, closeToast, dark, setDark } = useApp()
  const [bookings] = useBookings()
  const today = useToday()

  const active =
    navigation.find((item) => pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href)))
      ?.name ?? 'Catálogo'
  const pending = bookings.filter((booking) => booking.status === 'Pendiente').length
  const initials = session?.name.split(' ').map((part) => part[0]).slice(0, 2).join('') ?? 'AD'

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
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
              pathname === href || (href === '/admin/catalog' && pathname === '/admin/services')
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
          <div className="admin-crumb">
            <span>Altura Club</span>
            <ChevronRight size={14} />
            <b>{active}</b>
          </div>
          <div className="admin-top-actions">
            <span className="admin-today">
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
            <span className="admin-avatar">{initials}</span>
          </div>
        </header>
        <div className="admin-content">{children}</div>
      </section>
      <ToastMessage message={toast.message} kind={toast.kind} close={closeToast} />
    </main>
  )
}
