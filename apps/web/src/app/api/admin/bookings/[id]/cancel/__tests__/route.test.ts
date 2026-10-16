/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test'
import assert from 'node:assert/strict'
import { adminBookingCancelSchema } from '@sportcomplex/validation'

const { createMockPrisma } = await import('@db-test/mock-prisma')
const mock = createMockPrisma()
;(globalThis as any).__scPrisma = mock
Reflect.set(process.env, 'NODE_ENV', 'test')

const adminId = '00000000-0000-4000-8000-000000000021'
mock._state.usuarios.push({
  id: adminId,
  nombre: 'Admin Reservas',
  correo: 'admin.reservas@sportcomplex.com',
  estado: 'ACTIVO',
  deletedAt: null,
  rolId: 1,
  rolNombre: 'ADMINISTRADOR',
})
;(globalThis as any).__scAuthSession = { user: { id: adminId } }

const cancelRoute = await import('@/app/api/admin/bookings/[id]/cancel/route')

test('TSK-FE-28 / ZOD: adminBookingCancelSchema valida motivo >= 10 caracteres', () => {
  const valid = adminBookingCancelSchema.safeParse({
    motivo: 'Cierre preventivo de cancha por lluvia intensa',
  })
  assert.equal(valid.success, true)

  const short = adminBookingCancelSchema.safeParse({
    motivo: 'Lluvia',
  })
  assert.equal(short.success, false)
  if (!short.success) {
    assert.ok(short.error.issues[0]?.message.includes('10 caracteres'))
  }

  const empty = adminBookingCancelSchema.safeParse({
    motivo: '',
  })
  assert.equal(empty.success, false)
})

test('TSK-FE-28 / API: PATCH /api/admin/bookings/[id]/cancel rechaza motivo menor a 10 caracteres (422)', async () => {
  const admin = mock._state.usuarios.find((u: { id: string }) => u.id === adminId)!
  admin.rolNombre = 'ADMINISTRADOR'

  const req = new Request('http://localhost:3000/api/admin/bookings/res-123/cancel', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ motivo: 'Corta' }),
  })

  const res = await cancelRoute.PATCH(req, { params: Promise.resolve({ id: 'res-123' }) })
  assert.equal(res.status, 422)
  const json = await res.json()
  assert.equal(json.success, false)
  assert.equal(json.error.code, 'VALIDATION_ERROR')
})

test('TSK-FE-28 / API: PATCH /api/admin/bookings/[id]/cancel rechaza rol no-Administrador (403)', async () => {
  const admin = mock._state.usuarios.find((u: { id: string }) => u.id === adminId)!
  admin.rolNombre = 'CLIENTE'

  const req = new Request('http://localhost:3000/api/admin/bookings/res-123/cancel', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ motivo: 'Motivo suficientemente largo para la prueba' }),
  })

  const res = await cancelRoute.PATCH(req, { params: Promise.resolve({ id: 'res-123' }) })
  assert.equal(res.status, 403)
  const json = await res.json()
  assert.equal(json.success, false)
  assert.equal(json.error.code, 'FORBIDDEN')
})
