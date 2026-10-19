import { test } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminBookingCancelModal } from './AdminBookingCancelModal'
import type { AdminBookingItem } from './types'

const mockBooking: AdminBookingItem = {
  id: 'res-test-uuid-999',
  disponibilidadId: 'disp-1',
  titularId: 'user-1',
  vendedorId: null,
  pagoId: 'pay-1',
  membresiaId: null,
  inhabilitacionId: null,
  cantidadCupos: 2,
  canal: 'ONLINE',
  estado: 'CONFIRMADA',
  subtotal: 50000,
  descuentoPct: 0,
  total: 50000,
  expiraEn: null,
  creadoEn: '2026-10-15T10:00:00Z',
  titular: {
    id: 'user-1',
    nombre: 'Valeria Gómez',
    correo: 'valeria@example.com',
    avatar: null,
  },
  disponibilidad: {
    id: 'disp-1',
    fecha: '2026-10-20T00:00:00Z',
    servicioId: 1,
    franjaId: 1,
    servicio: {
      id: 1,
      nombre: 'Piscina Semiolímpica Climatizada',
      tarifa: 25000,
    },
    franja: {
      id: 1,
      diaSemana: 2,
      horaInicio: '2026-10-20T08:00:00Z',
      horaFin: '2026-10-20T09:00:00Z',
    },
  },
}

test('TSK-FE-28 / AdminBookingCancelModal: renderiza titular, servicio y campo de motivo', () => {
  const html = renderToStaticMarkup(
    <AdminBookingCancelModal
      booking={mockBooking}
      isOpen={true}
      onClose={() => {}}
      onConfirm={async () => {}}
    />
  )

  assert.ok(html.includes('Cancelar Reserva Administrativamente'), 'Debe mostrar el título del modal')
  assert.ok(html.includes('Valeria Gómez'), 'Debe mostrar el nombre del titular')
  assert.ok(html.includes('Piscina Semiolímpica Climatizada'), 'Debe mostrar el servicio')
  assert.ok(html.includes('id="cancel-motivo"'), 'Debe contener el textarea para el motivo')
  assert.ok(html.includes('Mínimo 10 caracteres obligatorios'), 'Debe indicar regla de validación de 10 caracteres')
})

test('TSK-FE-28 / AdminBookingCancelModal: retorna null cuando isOpen es false', () => {
  const html = renderToStaticMarkup(
    <AdminBookingCancelModal
      booking={mockBooking}
      isOpen={false}
      onClose={() => {}}
      onConfirm={async () => {}}
    />
  )

  assert.equal(html, '', 'No debe renderizar nada si isOpen es false')
})
