import { fail, ok } from '@sportcomplex/shared'
import { authorizeApiRequest } from '@/lib/api/api-auth'
import { adminBookingCancelSchema } from '@sportcomplex/validation'
import { cancelAdminBooking } from '@sportcomplex/db'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/admin/bookings/[id]/cancel
 * Cancelación administrativa justificada de reservas (RF-21, RN-12, TSK-FE-28).
 * Exclusivo de Administrador. Valida motivo obligatorio (min 10 chars).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const authorization = await authorizeApiRequest(['Administrador'])
    if (!authorization.authorized) return authorization.response

    const { id } = await params
    if (!id || typeof id !== 'string') {
      return fail('INVALID_ID', 'Identificador de reserva inválido', 400)
    }

    const body = await request.json().catch(() => ({}))
    const parsed = adminBookingCancelSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Datos de cancelación inválidos'
      return fail('VALIDATION_ERROR', firstError, 422)
    }

    const result = await cancelAdminBooking({
      bookingId: id,
      motivo: parsed.data.motivo,
      adminId: authorization.actor.id,
    })

    return ok(result, {
      message: 'Reserva cancelada administrativamente y cupos liberados con éxito.',
    })
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'RESERVA_NOT_FOUND') {
        return fail('NOT_FOUND', 'La reserva especificada no existe', 404)
      }
      if (error.message === 'RESERVA_ALREADY_CANCELLED') {
        return fail('ALREADY_CANCELLED', 'La reserva ya se encuentra cancelada o no puede anularse', 400)
      }
    }

    const message = error instanceof Error ? error.message : 'Error interno al procesar la cancelación'
    return fail('INTERNAL_SERVER_ERROR', message, 500)
  }
}
