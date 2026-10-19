import type {
  VerificationState,
  PollingOptions,
  ResolvePaymentResultInput,
} from '../types/checkout';

/**
 * Sondea la confirmación del backend tras el pago en pasarela.
 * Si el servidor confirma la reserva, retorna confirmed = true y el código oficial emitido.
 * Si vence el sondeo sin confirmación, retorna confirmed = false y NO inventa ningún código.
 */
export async function pollPaymentConfirmation({
  reservationId,
  userName,
  maxAttempts = 12,
  pollIntervalMs = 1500,
  fetchReceipt,
  fetchHistory,
}: PollingOptions): Promise<VerificationState> {
  if (!reservationId) {
    return { confirmed: false, bookingCode: null };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const receipt = await fetchReceipt(reservationId);
      if (
        receipt?.reserva?.id === reservationId &&
        receipt.reserva.estado === "CONFIRMADA" &&
        receipt.ticket &&
        receipt.qr?.payload
      ) {
        return {
          confirmed: true,
          bookingCode: receipt.qr.payload.slice(0, 16),
        };
      }
    } catch {
      // continuar sondeo
    }

    try {
      const history = await fetchHistory(userName, 5);
      const match = history.find(
        (h) => h.id === reservationId && h.status === "Confirmada" && h.ticketIssued,
      );
      if (match) {
        return {
          confirmed: true,
          bookingCode: match.code,
        };
      }
    } catch {
      // continuar sondeo
    }

    if (attempt < maxAttempts - 1 && pollIntervalMs > 0) {
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
  }

  return { confirmed: false, bookingCode: null };
}

/**
 * Resuelve el flujo posterior al pago según el resultado de verificación del backend.
 * Nunca genera reservas locales ni comprobantes apócrifos cuando el estado es pendiente.
 */
export function resolvePaymentOutcome({
  verification,
  onConfirmed,
  onPending,
}: ResolvePaymentResultInput): void {
  if (verification.confirmed && verification.bookingCode) {
    onConfirmed(verification.bookingCode);
  } else {
    onPending();
  }
}

export type TipoErrorReserva = 'sesion' | 'datos' | 'disponibilidad' | 'servidor'

export interface ErrorReserva {
  tipo: TipoErrorReserva
  titulo: string
  mensaje: string
}

/** Códigos de `/api/bookings` que significan "ese horario ya no se puede tomar". */
const CODIGOS_DISPONIBILIDAD = new Set([
  'CAPACITY_EXCEEDED',
  'SLOT_BLOCKED',
  'SLOT_IN_PAST',
  'SLOT_NOT_FOUND',
  'SERVICE_UNAVAILABLE',
  'HOLD_EXPIRED',
])
const CODIGOS_SESION = new Set(['UNAUTHORIZED', 'FORBIDDEN'])

/**
 * Clasifica el rechazo de `POST /api/bookings` por su código real
 * (`data.error.code`), para que el checkout no muestre un texto genérico
 * (issue #115): sesión inválida, datos inválidos o conflicto de disponibilidad.
 */
export function clasificarErrorReserva(
  status: number,
  body: { error?: { code?: string; message?: string } } | null | undefined,
): ErrorReserva {
  const code = body?.error?.code
  const detalle = body?.error?.message
  if (status === 401 || status === 403 || (code && CODIGOS_SESION.has(code))) {
    return {
      tipo: 'sesion',
      titulo: 'Tu sesión no es válida',
      mensaje: 'Inicia sesión con tu cuenta de cliente para reservar este horario.',
    }
  }
  if ((code && CODIGOS_DISPONIBILIDAD.has(code)) || status === 409) {
    return {
      tipo: 'disponibilidad',
      titulo: 'Ese horario ya no está disponible',
      mensaje: detalle || 'El cupo se ocupó o la franja dejó de estar disponible. Elige otro horario.',
    }
  }
  if (status >= 400 && status < 500) {
    return {
      tipo: 'datos',
      titulo: 'No se pudo reservar el horario',
      mensaje: detalle || 'Los datos de la reserva no son válidos. Vuelve a seleccionar el servicio y el horario.',
    }
  }
  return {
    tipo: 'servidor',
    titulo: 'No se pudo reservar el horario',
    mensaje: detalle || 'Ocurrió un error en el servidor. Intenta de nuevo en unos minutos.',
  }
}

/**
 * `serviceId` numérico que exigen las APIs de reserva (issue #114): el `id` del
 * catálogo es el slug; el número viene en `dbId`. `null` si no se puede resolver.
 */
export function resolverServiceIdReserva(item: { id: string; dbId?: number }): number | null {
  const id = item.dbId ?? Number(item.id)
  return Number.isInteger(id) && id > 0 ? id : null
}
