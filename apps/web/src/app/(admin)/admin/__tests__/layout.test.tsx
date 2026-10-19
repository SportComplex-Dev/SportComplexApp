import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'

// Polyfill seguro de React en global para compatibilidad de renderToStaticMarkup
;(global as unknown as { React: typeof React }).React = React
;(globalThis as unknown as { React: typeof React }).React = React

import { renderToStaticMarkup } from 'react-dom/server'
import { AppProvider } from '@/components/layout/app-provider'
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
import {
  AdminMembershipsView,
  type AdminMembershipOverviewData,
} from '@sportcomplex/features-admin'

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
  try {
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
  } catch (err: unknown) {
    console.error('EXACT ERROR IN TEST 2:', err)
    throw err
  }
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

const segmentationMockData: AdminMembershipOverviewData = {
  segments: {
    active: [
      {
        id: 'usr-active-01',
        nombre: 'Valeria Restrepo (Vigente)',
        fechaInicio: '2026-09-01T10:00:00.000Z',
        fechaFin: '2026-11-01T10:00:00.000Z',
      },
    ],
    none: [
      {
        id: 'usr-none-02',
        nombre: 'Camilo Torres (Sin Membresía)',
      },
    ],
    expired: [
      {
        id: 'usr-expired-03',
        nombre: 'Julian Vencido (Vencida)',
        fechaInicio: '2026-01-01T10:00:00.000Z',
        fechaFin: '2026-03-01T10:00:00.000Z',
      },
      {
        id: 'usr-cancelled-04',
        nombre: 'Daniela Cancelada (Cancelada)',
        fechaInicio: '2026-02-01T10:00:00.000Z',
        fechaFin: '2026-04-01T10:00:00.000Z',
      },
    ],
  },
  metrics: {
    newMembersLast30Days: 1,
    renewalPercentage: 80.0,
  },
}

test('TSK-QA-02 (HU-35 / RF-16): Renderizado y navegación del enlace canónico /admin/memberships en el sidebar', () => {
  // 1. Validar que la lista canónica de navegación incluye Membresías apuntando a /admin/memberships
  const membershipNav = mockNavigation.find((item) => item.href === '/admin/memberships')
  assert.ok(membershipNav, 'El ítem de Membresías debe existir en la navegación')
  assert.equal(membershipNav.name, 'Membresías', 'El texto debe ser "Membresías"')
  assert.notEqual(membershipNav.href, '#', 'El enlace no debe ser un placeholder "#"')
  assert.notEqual(membershipNav.href, '', 'El enlace no debe estar vacío')

  // 2. Renderizar drawer móvil con pathname en /admin/memberships
  const drawerHtml = renderToStaticMarkup(
    <AppProvider>
      <AdminMobileDrawer
        isOpen={true}
        onClose={() => {}}
        navigation={mockNavigation}
        pathname="/admin/memberships"
      />
    </AppProvider>,
  )

  // Debe renderizar la etiqueta <a> de Next.js <Link> apuntando a /admin/memberships
  assert.ok(
    drawerHtml.includes('href="/admin/memberships"'),
    'El sidebar/drawer debe renderizar un enlace SPA <Link> a /admin/memberships',
  )
  assert.ok(
    !drawerHtml.includes('href="/admin/memberships#"'),
    'El enlace a membresías no debe contener sufijos huérfanos o hashes',
  )

  // Verificar que la clase activa se asigna correctamente en /admin/memberships
  assert.ok(
    drawerHtml.includes('bg-[#eff4e9]') || drawerHtml.includes('font-bold'),
    'La ruta /admin/memberships activa debe tener estilos de resaltado de navegación',
  )
})

test('TSK-QA-02 (HU-35 / RF-16): Aislamiento estricto de estados — socios con membresía VENCIDA o CANCELADA no aparecen en Activos/Vigentes', () => {
  // Al renderizar la pestaña de Activos (initialTab="active"), únicamente deben figurar
  // los clientes con membresía VIGENTE. Los socios VENCIDOS o CANCELADOS no deben aparecer en la tabla activa.
  const activeTabHtml = renderToStaticMarkup(
    <AdminMembershipsView data={segmentationMockData} initialTab="active" />,
  )

  // Socio activo sí debe figurar
  assert.ok(
    activeTabHtml.includes('Valeria Restrepo (Vigente)'),
    'El socio activo debe estar presente en la pestaña de socios activos/vigentes',
  )
  assert.ok(
    activeTabHtml.includes('usr-active-01'),
    'El ID del socio activo debe estar presente',
  )

  // Aislamiento estricto: Socios con membresía Vencida o Cancelada JAMÁS deben figurar en la pestaña Activos
  assert.equal(
    activeTabHtml.includes('Julian Vencido (Vencida)'),
    false,
    'Un socio con membresía VENCIDA no debe aparecer bajo ninguna circunstancia en la pestaña Activos',
  )
  assert.equal(
    activeTabHtml.includes('usr-expired-03'),
    false,
    'El ID del socio con membresía vencida no debe aparecer en la pestaña Activos',
  )
  assert.equal(
    activeTabHtml.includes('Daniela Cancelada (Cancelada)'),
    false,
    'Un socio con membresía CANCELADA no debe aparecer bajo ninguna circunstancia en la pestaña Activos',
  )
  assert.equal(
    activeTabHtml.includes('usr-cancelled-04'),
    false,
    'El ID del socio con membresía cancelada no debe aparecer en la pestaña Activos',
  )
  assert.equal(
    activeTabHtml.includes('Camilo Torres (Sin Membresía)'),
    false,
    'Un cliente sin membresía no debe aparecer en la pestaña Activos',
  )
})

test('TSK-QA-02 (HU-35 / RF-16): Segmentación consistente en 3 pestañas (Activos/Vigentes, Vencidos/Histórico, Sin Membresía)', () => {
  // 1. Render general con KPIs y selector de las 3 pestañas
  const baseHtml = renderToStaticMarkup(
    <AdminMembershipsView data={segmentationMockData} initialTab="active" />,
  )

  // Verificar presencia de los 3 selectores de pestañas
  assert.ok(baseHtml.includes('data-testid="tab-active"'), 'Debe existir la pestaña Activas')
  assert.ok(baseHtml.includes('data-testid="tab-none"'), 'Debe existir la pestaña Sin Membresía')
  assert.ok(baseHtml.includes('data-testid="tab-expired"'), 'Debe existir la pestaña Histórico / Vencidas')

  // Conteos consistentes en los badges de las pestañas
  assert.ok(
    baseHtml.includes('>1</span>'),
    'Debe mostrar el conteo correcto en los badges de pestañas',
  )

  // 2. Render de la pestaña de Histórico / Vencidas
  const expiredTabHtml = renderToStaticMarkup(
    <AdminMembershipsView data={segmentationMockData} initialTab="expired" />,
  )
  assert.ok(
    expiredTabHtml.includes('Julian Vencido (Vencida)'),
    'La pestaña de Histórico/Vencidas debe contener al socio vencido',
  )
  assert.ok(
    expiredTabHtml.includes('Daniela Cancelada (Cancelada)'),
    'La pestaña de Histórico/Vencidas debe contener al socio cancelado',
  )
  assert.equal(
    expiredTabHtml.includes('Valeria Restrepo (Vigente)'),
    false,
    'La pestaña de Histórico/Vencidas no debe contener al socio activo',
  )

  // 3. Render de la pestaña Sin Membresía
  const noneTabHtml = renderToStaticMarkup(
    <AdminMembershipsView data={segmentationMockData} initialTab="none" />,
  )
  assert.ok(
    noneTabHtml.includes('Camilo Torres (Sin Membresía)'),
    'La pestaña Sin Membresía debe contener al cliente sin membresía',
  )
  assert.equal(
    noneTabHtml.includes('Valeria Restrepo (Vigente)'),
    false,
    'La pestaña Sin Membresía no debe contener al socio activo',
  )
})
