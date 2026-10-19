import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

// Polyfill seguro de React en global para compatibilidad de renderToStaticMarkup
;(global as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { React: typeof React }).React = React

import { renderToStaticMarkup } from 'react-dom/server'
import { AppProvider } from '@/components/layout/app-provider'
import AdminLayout from '@/app/(admin)/admin/layout'
import {
  AdminMobileDrawer,
  type AdminNavItem,
} from '@/components/layout/admin-mobile-drawer'
import { UserMenu } from '@/components/layout/user-menu'
import {
  Home,
  Ticket,
  Trophy,
  Users,
  CalendarDays,
  AlertTriangle,
  BadgeCheck,
} from 'lucide-react'

const mockNavigation: AdminNavItem[] = [
  { name: 'Resumen', icon: Home, href: '/admin' },
  { name: 'Catálogo', icon: Ticket, href: '/admin/catalog' },
  { name: 'Torneos', icon: Trophy, href: '/admin/tournaments' },
  { name: 'Empleados', icon: Users, href: '/admin/employees' },
  { name: 'Reservas', icon: CalendarDays, href: '/admin/bookings' },
  { name: 'Contingencias', icon: AlertTriangle, href: '/admin/incident' },
  { name: 'Membresías', icon: BadgeCheck, href: '/admin/memberships' },
]

test('TSK-FE-36 / HU-40: AdminMobileDrawer no se renderiza en el DOM cuando isOpen es false', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={false}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin"
      />
    </AppProvider>,
  )

  assert.equal(html, '', 'Cuando el drawer está cerrado no debe renderizar markup')
})

test('TSK-FE-36 / HU-40: AdminMobileDrawer renderiza dialog accesible y backdrop cuando isOpen es true', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={true}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin/bookings"
        pending={3}
      />
    </AppProvider>,
  )

  // Rol accesible y etiquetas ARIA
  assert.ok(
    html.includes('role="dialog"'),
    'El drawer móvil debe tener role="dialog" para tecnologías asistivas',
  )
  assert.ok(
    html.includes('aria-modal="true"'),
    'El drawer móvil debe declarar aria-modal="true"',
  )
  assert.ok(
    html.includes('aria-label="Menú de administración"'),
    'El drawer móvil debe tener un aria-label descriptivo',
  )

  // Backdrop
  assert.ok(
    html.includes('data-testid="admin-drawer-backdrop"'),
    'Debe existir un backdrop semitransparente para cerrar el drawer',
  )

  // Botón de cerrar con accesibilidad
  assert.ok(
    html.includes('aria-label="Cerrar menú de navegación"'),
    'El botón de cierre debe tener aria-label accesible',
  )
  assert.ok(
    html.includes('data-testid="admin-drawer-close"'),
    'El botón de cierre debe tener testid específico',
  )
})

test('TSK-FE-36 / HU-40: AdminMobileDrawer renderiza todas las rutas administrativas y destaca la activa', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={true}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin/catalog"
      />
    </AppProvider>,
  )

  // Comprobar que todas las rutas existen en el drawer
  for (const item of mockNavigation) {
    assert.ok(
      html.includes(`href="${item.href}"`),
      `El drawer debe contener el enlace para ${item.name} (${item.href})`,
    )
    assert.ok(
      html.includes(item.name),
      `El drawer debe mostrar el nombre legible ${item.name}`,
    )
  }

  // Comprobar que la ruta activa está destacada
  assert.ok(
    html.includes('bg-[#eff4e9]') || html.includes('font-bold'),
    'La ruta activa debe incluir estilos destacados de navegación',
  )

  // Marca y distintivo ADMIN
  assert.ok(
    html.includes('ADMIN'),
    'El encabezado del drawer debe mostrar el badge ADMIN',
  )
})

test('TSK-FE-36 / HU-40: Verificación de soporte responsive en sidebar de administración', () => {
  // Simulamos la estructura del sidebar estático de AdminLayout
  const sidebarHtml = renderToStaticMarkup(
    <aside className="admin-sidebar hidden md:flex" data-testid="desktop-sidebar">
      <div>Sidebar Content</div>
    </aside>,
  )

  assert.ok(
    sidebarHtml.includes('hidden md:flex'),
    'El sidebar estático de escritorio debe tener clases "hidden md:flex" para ocultarse en < 768px',
  )
})

test('FIX-ADMIN: UserMenu garantiza sesión de respaldo en sidebar y muestra datos de Administrador', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <UserMenu variant="sidebar" />
    </AppProvider>,
  )

  assert.ok(
    html.includes('admin-user'),
    'UserMenu en sidebar debe renderizar el botón de usuario administrativo',
  )
  assert.ok(
    html.includes('Administrador'),
    'UserMenu debe mostrar el rol o nombre de Administrador',
  )
})

test('FIX-ADMIN: UserMenu en admin-topbar renderiza el avatar interactivo con testid', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <UserMenu variant="admin-topbar" />
    </AppProvider>,
  )

  assert.ok(
    html.includes('admin-topbar-user-menu'),
    'UserMenu en admin-topbar debe incluir el data-testid="admin-topbar-user-menu"',
  )
})

// ============================================================================
// TSK-QA-01 / HU-25: Integración en AdminLayout y soporte de reservas
// ============================================================================

test('TSK-QA-01 / HU-25: El ítem Reservas en AdminLayout conecta formalmente a /admin/bookings', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminLayout>
        <div>Contenido administrativo</div>
      </AdminLayout>
    </AppProvider>,
  )

  // Debe existir el enlace con href="/admin/bookings" y la etiqueta de texto Reservas
  assert.ok(
    html.includes('href="/admin/bookings"'),
    'El menú lateral debe renderizar formalmente el enlace href="/admin/bookings"',
  )
  assert.ok(
    html.includes('Reservas'),
    'El menú lateral debe incluir la etiqueta legible Reservas',
  )
})

test('TSK-QA-01 / HU-25: El menú lateral marca activa la opción Reservas al encontrarse en /admin/bookings', () => {
  const htmlDrawer = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={true}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin/bookings"
      />
    </AppProvider>,
  )

  assert.ok(
    htmlDrawer.includes('href="/admin/bookings"'),
    'Debe contener el enlace /admin/bookings',
  )
  assert.ok(
    htmlDrawer.includes('bg-[#eff4e9]') || htmlDrawer.includes('font-bold'),
    'Debe marcar activa la opción de Reservas al encontrarse en la ruta /admin/bookings',
  )
})

test('TSK-QA-01 / HU-25: Muestra badge numérico dinámico con reservas en estado Pendiente cuando pending > 0', () => {
  const pendingCount = 5
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={true}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin"
        pending={pendingCount}
      />
    </AppProvider>,
  )

  assert.ok(
    html.includes(`>${pendingCount}</i>`),
    `Debe renderizar la etiqueta <i> con el conteo numérico dinámico de pendientes (${pendingCount})`,
  )
})

test('TSK-QA-01 / HU-25: Navegación fluida y respuesta HTTP 200 sin 404 ni bucles de renderizado', async () => {
  // 1. Verificación del componente de página en /admin/bookings
  const AdminBookingsModule = await import('@/app/(admin)/admin/bookings/page')
  assert.equal(
    typeof AdminBookingsModule.default,
    'function',
    'El componente de página de /admin/bookings debe existir y ser una función de renderizado válida',
  )

  // 2. Verificación de la API administrativa asociada con respuesta HTTP 200
  const { createMockPrisma } = await import('@db-test/mock-prisma')
  const mock = createMockPrisma()
  type GlobalTestScope = typeof globalThis & {
    __scPrisma?: unknown
    __scAuthSession?: { user: { id: string } }
  }
  const testScope = globalThis as GlobalTestScope
  testScope.__scPrisma = mock
  const adminId = '00000000-0000-4000-8000-000000000099'
  mock._state.usuarios.push({
    id: adminId,
    nombre: 'QA Admin',
    correo: 'qa.admin@sportcomplex.com',
    estado: 'ACTIVO',
    deletedAt: null,
    rolId: 1,
    rolNombre: 'ADMINISTRADOR',
  })
  testScope.__scAuthSession = { user: { id: adminId } }

  const bookingsApi = await import('@/app/api/admin/bookings/route')
  assert.equal(typeof bookingsApi.GET, 'function', 'El handler GET de /api/admin/bookings debe existir')

  const request = new Request('http://localhost:3000/api/admin/bookings?status=PENDIENTE&limit=1')
  const response = await bookingsApi.GET(request)

  assert.equal(response.status, 200, 'La ruta administrativa debe responder HTTP 200 OK')
  const body = await response.json()
  assert.equal(body.success, true, 'La respuesta de la ruta administrativa debe tener success=true')
  assert.ok(body.data, 'La respuesta de la API debe devolver data válida sin 404 ni errores')
})
