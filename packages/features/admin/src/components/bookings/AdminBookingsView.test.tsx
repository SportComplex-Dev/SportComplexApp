import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  AdminBookingsView,
  formatStatusBadge,
  formatDateString,
  formatSlotTime,
} from './AdminBookingsView'
import type { AdminBookingItem } from './types'

const mockBookings: AdminBookingItem[] = [
  {
    id: 'res-uuid-12345678',
    disponibilidadId: 'disp-1',
    titularId: 'user-1',
    vendedorId: null,
    pagoId: 'pay-1',
    membresiaId: null,
    inhabilitacionId: null,
    cantidadCupos: 1,
    canal: 'ONLINE',
    estado: 'CONFIRMADA',
    subtotal: 48000,
    descuentoPct: 0,
    total: 48000,
    expiraEn: null,
    creadoEn: '2026-10-15T10:00:00Z',
    titular: {
      id: 'user-1',
      nombre: 'Carlos Santana',
      correo: 'carlos@example.com',
      avatar: null,
    },
    disponibilidad: {
      id: 'disp-1',
      fecha: '2026-10-16T00:00:00Z',
      servicioId: 1,
      franjaId: 1,
      servicio: {
        id: 1,
        nombre: 'Cancha de Tenis · Cancha 1',
        tarifa: 48000,
        categoria: {
          id: 1,
          nombre: 'Canchas',
          tipo: 'TENIS',
        },
      },
      franja: {
        id: 1,
        diaSemana: 5,
        horaInicio: '2026-10-16T07:00:00Z',
        horaFin: '2026-10-16T08:00:00Z',
      },
    },
  },
]

test('TSK-FE-27 / formatStatusBadge retorna badges semánticos con componente Badge de @sportcomplex/ui', () => {
  const confirmedMarkup = renderToStaticMarkup(formatStatusBadge('CONFIRMADA'))
  assert.ok(confirmedMarkup.includes('Confirmada'), 'Debe incluir texto Confirmada')
  assert.ok(confirmedMarkup.includes('data-slot="badge"'), 'Debe utilizar Badge de @sportcomplex/ui')

  const pendingMarkup = renderToStaticMarkup(formatStatusBadge('PENDIENTE_PAGO'))
  assert.ok(pendingMarkup.includes('Pendiente Pago'), 'Debe incluir Pendiente Pago')
  assert.ok(pendingMarkup.includes('data-slot="badge"'), 'Debe utilizar Badge de @sportcomplex/ui')

  const expiredMarkup = renderToStaticMarkup(formatStatusBadge('EXPIRADA'))
  assert.ok(expiredMarkup.includes('Expirada'), 'Debe incluir Expirada')
  assert.ok(expiredMarkup.includes('data-slot="badge"'), 'EXPIRADA debe utilizar Badge de @sportcomplex/ui')

  const cancelledMarkup = renderToStaticMarkup(formatStatusBadge('CANCELADA'))
  assert.ok(cancelledMarkup.includes('Cancelada'), 'Debe incluir Cancelada')
  assert.ok(cancelledMarkup.includes('data-slot="badge"'), 'Debe utilizar Badge de @sportcomplex/ui')
})

test('TSK-FE-27 / formatDateString previene desfase de fecha (off-by-one) por UTC-5 en medianoche', () => {
  // Cadena ISO con medianoche UTC: no debe retroceder al día anterior (15 oct) en Bogotá UTC-5
  const formattedUtcMidnight = formatDateString('2026-10-16T00:00:00Z')
  assert.ok(formattedUtcMidnight.includes('16'), 'Debe mantener el día 16 y no retroceder al 15')

  // Cadena YYYY-MM-DD limpia
  const formattedDateOnly = formatDateString('2026-10-16')
  assert.ok(formattedDateOnly.includes('16'), 'Debe mantener el día 16 para formato YYYY-MM-DD')
})

test('TSK-FE-27 / formatSlotTime parsea cadenas directas de hora HH:mm y HH:mm:ss sin caer a fallback', () => {
  assert.strictEqual(formatSlotTime('07:00'), '07:00', 'Debe parsear 07:00 directamente')
  assert.strictEqual(formatSlotTime('07:00:00'), '07:00', 'Debe recortar segundos en 07:00:00')
  assert.strictEqual(formatSlotTime('18:30'), '18:30', 'Debe parsear 18:30 directamente')
})

test('TSK-FE-27 / AdminBookingsView renderiza encabezados, KPIs con Card y filas de reservas', () => {
  const markup = renderToStaticMarkup(
    <AdminBookingsView
      bookings={mockBookings}
      total={1}
      metrics={{
        todayTotal: 1,
        confirmedCount: 1,
        pendingCount: 0,
        byService: [{ serviceId: 1, serviceName: 'Cancha de Tenis · Cancha 1', count: 1 }],
      }}
      filters={{
        search: '',
        status: '',
        serviceId: '',
        dateFrom: '',
        dateTo: '',
        page: 1,
        limit: 20,
      }}
      onFiltersChange={() => {}}
      onRefresh={() => {}}
    />
  )

  assert.ok(markup.includes('Gestión y Control de Reservas'), 'Debe mostrar el título principal')
  assert.ok(markup.includes('Carlos Santana'), 'Debe renderizar el nombre del cliente titular')
  assert.ok(markup.includes('carlos@example.com'), 'Debe mostrar el correo del cliente')
  assert.ok(markup.includes('Cancha de Tenis · Cancha 1'), 'Debe mostrar el nombre del servicio')
  assert.ok(markup.includes('res-uuid'), 'Debe mostrar el código o UUID de la reserva')
  assert.ok(markup.includes('data-slot="card"'), 'Los KPIs deben usar componente Card de @sportcomplex/ui')
  assert.ok(markup.includes('min-w-[700px]'), 'La tabla debe tener min-w para adaptabilidad móvil con scroll horizontal')
})

test('TSK-FE-27 / AdminBookingsView renderiza empty state cuando no hay reservas', () => {
  const markup = renderToStaticMarkup(
    <AdminBookingsView
      bookings={[]}
      total={0}
      metrics={{ todayTotal: 0, confirmedCount: 0, pendingCount: 0, byService: [] }}
      filters={{
        search: '',
        status: '',
        serviceId: '',
        dateFrom: '',
        dateTo: '',
        page: 1,
        limit: 20,
      }}
      onFiltersChange={() => {}}
      onRefresh={() => {}}
    />
  )

  assert.ok(markup.includes('No se encontraron reservas'), 'Debe desplegar el mensaje de empty state')
})
