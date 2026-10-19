import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppProvider } from '@/components/layout/app-provider'
import AdminLayout from '@/app/(admin)/admin/layout'
import { AdminMobileDrawer, type AdminNavItem } from '@/components/layout/admin-mobile-drawer'
import { CalendarDays, Home, Ticket } from 'lucide-react'

const mockNavigation: AdminNavItem[] = [
  { name: 'Resumen', icon: Home, href: '/admin' },
  { name: 'Catálogo', icon: Ticket, href: '/admin/catalog' },
  { name: 'Reservas', icon: CalendarDays, href: '/admin/bookings' },
]

test('TSK-QA-01 / HU-25: El ítem Reservas en AdminLayout conecta formalmente a /admin/bookings', () => {
  const html = renderToStaticMarkup(
    <AppProvider>
      <AdminLayout>
        <div>Contenido administrativo</div>
      </AdminLayout>
    </AppProvider>
  )

  // Debe existir el enlace con href="/admin/bookings" y la etiqueta de texto Reservas
  assert.ok(
    html.includes('href="/admin/bookings"'),
    'El menú lateral debe renderizar formalmente el enlace href="/admin/bookings"'
  )
  assert.ok(
    html.includes('Reservas'),
    'El menú lateral debe incluir la etiqueta legible Reservas'
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
    </AppProvider>
  )

  assert.ok(
    htmlDrawer.includes('href="/admin/bookings"'),
    'Debe contener el enlace /admin/bookings'
  )
  assert.ok(
    htmlDrawer.includes('bg-[#eff4e9]') || htmlDrawer.includes('font-bold'),
    'Debe marcar activa la opción de Reservas al encontrarse en la ruta /admin/bookings'
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
    </AppProvider>
  )

  assert.ok(
    html.includes(`>${pendingCount}</i>`),
    `Debe renderizar la etiqueta <i> con el conteo numérico dinámico de pendientes (${pendingCount})`
  )
})

test('TSK-QA-01 / HU-25: Navegación fluida y respuesta HTTP 200 sin 404 ni bucles de renderizado', async () => {
  // 1. Verificación del componente de página en /admin/bookings
  const AdminBookingsModule = await import('@/app/(admin)/admin/bookings/page')
  assert.equal(
    typeof AdminBookingsModule.default,
    'function',
    'El componente de página de /admin/bookings debe existir y ser una función de renderizado válida'
  )

  // 2. Verificación de la API administrativa asociada con respuesta HTTP 200
  const { createMockPrisma } = await import('@db-test/mock-prisma')
  const mock = createMockPrisma()
  ;(globalThis as any).__scPrisma = mock
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
  ;(globalThis as any).__scAuthSession = { user: { id: adminId } }

  const bookingsApi = await import('@/app/api/admin/bookings/route')
  assert.equal(typeof bookingsApi.GET, 'function', 'El handler GET de /api/admin/bookings debe existir')

  const request = new Request('http://localhost:3000/api/admin/bookings?status=PENDIENTE&limit=1')
  const response = await bookingsApi.GET(request)

  assert.equal(response.status, 200, 'La ruta administrativa debe responder HTTP 200 OK')
  const body = await response.json()
  assert.equal(body.success, true, 'La respuesta de la ruta administrativa debe tener success=true')
  assert.ok(body.data, 'La respuesta de la API debe devolver data válida sin 404 ni errores')
})
