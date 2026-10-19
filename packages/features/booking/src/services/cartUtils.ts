import type {
  CartItem,
  DynamicTimeSlot,
  AddToCartValidationResult,
  CheckoutRedirection,
} from '../types/cart';
import type { ContinuousLockCartPayload, LockCartPayload, SingleLockPayload } from '../types/booking';
import { formatMoney } from '../utils/formatters';
import { getBogotaDateAfter, getBogotaTodayISO } from '../utils/date';

export const SERVICE_NUMERIC_ID_MAP: Record<string, number> = {
  'tenis-cancha-1': 1,
  'tenis-cancha-2': 2,
  'padel-cancha-1': 3,
  'futbol-5-cancha-1': 4,
  'futbol-5-cancha-2': 5,
  'piscina-nado-libre': 6,
  'piscina-carril-entrenamiento': 7,
  'piscina-infantil': 8,
  'gimnasio-sesion-individual': 9,
  'gimnasio-funcional': 10,
  'zona-humeda-sauna': 11,
  'zona-humeda-turco-jacuzzi': 12,
};

export function getNumericServiceId(serviceId: string): number {
  const numericId = SERVICE_NUMERIC_ID_MAP[serviceId];
  if (!numericId) {
    throw new Error(`Servicio desconocido o sin identificador numérico configurado: ${serviceId}`);
  }
  return numericId;
}

// Re-export utility functions for convenience and backwards compatibility
export { formatMoney, getBogotaDateAfter, getBogotaTodayISO };

/**
 * Genera dinámicamente las franjas horarias del complejo entre 06:00 y 22:00 (turnos continuos de 60 min).
 * Aplica la regla RN-11 deshabilitando horas transcurridas si la fecha seleccionada es hoy en Bogotá o una fecha anterior.
 */
export function generateDynamicTimeSlots(
  dateStr: string,
  now: Date = new Date(),
  startHour = 6,
  endHour = 22,
): DynamicTimeSlot[] {
  const todayBogota = getBogotaTodayISO(now);
  const currentBogotaHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(now),
  );

  const slots: DynamicTimeSlot[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');

  for (let h = startHour; h < endHour; h++) {
    const startTime = `${pad(h)}:00`;
    const endTime = `${pad(h + 1)}:00`;
    const isDatePast = dateStr < todayBogota;
    const isPast = isDatePast || (dateStr === todayBogota && h <= currentBogotaHour);

    slots.push({
      startTime,
      endTime,
      label: `${startTime} – ${endTime}`,
      isAvailable: !isPast,
      disabledReason: isPast ? (isDatePast ? 'Fecha concluida' : 'Horario concluido') : undefined,
    });
  }

  return slots;
}

/**
 * RN-07 (Multirreserva concurrente):
 * El titular puede reservar múltiples servicios para la misma fecha y bloque horario [HoraInicio, HoraFin]
 * siempre que correspondan a servicios/instalaciones diferentes (ej. Cancha Sintética 1 + Piscina Libre de 17:00 a 18:00).
 *
 * Validación del Carrito:
 * - Permitir ítems con el mismo startTime y endTime SIEMPRE que serviceId sea diferente.
 * - Deshabilitar/rechazar duplicados exactos (mismo serviceId, misma fecha y misma franja).
 * - Restringir a la misma fecha y franja horaria para checkout conjunto.
 */
export function validateCanAddToCart(
  cart: CartItem[],
  newItem: {
    serviceId: string;
    numericServiceId?: number;
    date: string;
    startTime: string;
    endTime: string;
  },
): AddToCartValidationResult {
  // Duplicado exacto: mismo servicio ya en el carrito
  const isDuplicate = cart.some(
    (item) =>
      item.serviceId === newItem.serviceId ||
      (newItem.numericServiceId !== undefined && item.numericServiceId === newItem.numericServiceId),
  );

  if (isDuplicate) {
    return {
      valid: false,
      code: 'DUPLICATE_ITEM',
      message: 'Este servicio ya está en tu carrito.',
    };
  }

  // Mismo horario: si el carrito ya tiene ítems, deben coincidir en fecha y franja horaria
  if (cart.length > 0) {
    const activeSlot = cart[0];
    if (
      activeSlot &&
      (activeSlot.date !== newItem.date ||
        activeSlot.startTime !== newItem.startTime ||
        activeSlot.endTime !== newItem.endTime)
    ) {
      return {
        valid: false,
        code: 'DIFFERENT_SLOT',
        message:
          'Para reservar juntos en la misma compra, los servicios deben pertenecer a la misma fecha y franja horaria.',
      };
    }
  }

  return { valid: true };
}

/**
 * Total acumulado consolidado del carrito
 */
export function calculateCartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + item.price, 0);
}

/**
 * Construcción del payload multi-servicio para POST /api/bookings/lock-cart según esquema Zod (@sportcomplex/validation)
 */
export function buildLockCartPayload(cart: CartItem[], defaultDate: string): LockCartPayload {
  return {
    items: cart.map((item) => {
      const itemDate = item.date || defaultDate;
      return {
        serviceId: item.numericServiceId,
        date: itemDate,
        startTime: new Date(`${itemDate}T${item.startTime}:00-05:00`).toISOString(),
        endTime: new Date(`${itemDate}T${item.endTime}:00-05:00`).toISOString(),
        cantidadCupos: 1,
      };
    }),
  };
}

/** Construye el payload atómico de una sola cancha/servicio con franjas contiguas. */
export function buildContinuousLockCartPayload(
  serviceId: number,
  slots: DynamicTimeSlot[],
  date: string,
): ContinuousLockCartPayload {
  if (slots.length < 2) throw new Error('Se requieren al menos dos franjas continuas.');
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const continuity = validateContinuousSlots(sorted);
  if (!continuity.valid) throw new Error(continuity.message);

  return {
    serviceId,
    franjas: sorted.map((slot) => ({
      inicio: new Date(`${date}T${slot.startTime}:00-05:00`).toISOString(),
      fin: new Date(`${date}T${slot.endTime}:00-05:00`).toISOString(),
    })),
  };
}

/**
 * Construcción del payload individual para POST /api/bookings/lock
 */
export function buildSingleLockPayload(item: CartItem, defaultDate: string): SingleLockPayload {
  const itemDate = item.date || defaultDate;
  return {
    serviceId: item.numericServiceId,
    date: itemDate,
    startTime: new Date(`${itemDate}T${item.startTime}:00-05:00`).toISOString(),
    endTime: new Date(`${itemDate}T${item.endTime}:00-05:00`).toISOString(),
    cantidadCupos: 1,
  };
}

/**
 * Resuelve la URL de destino tras el bloqueo exitoso de reservas.
 * Si Stripe genera una URL absoluta externa (http/https), se marca como externa para redirección de navegador completo.
 * De lo contrario, se procesa como ruta interna de la aplicación (/checkout).
 */
export function resolveCheckoutRedirection(
  checkoutUrl?: string | null,
  bookingIds: string[] = [],
): CheckoutRedirection {
  if (checkoutUrl && (checkoutUrl.startsWith('http://') || checkoutUrl.startsWith('https://'))) {
    return { type: 'external', url: checkoutUrl };
  }

  const query =
    bookingIds.length > 0
      ? `?bookingIds=${bookingIds.join(',')}&bookingId=${bookingIds[0]}`
      : '';
  return {
    type: 'internal',
    url: checkoutUrl || `/checkout${query}`,
  };
}


/**
 * TSK-FE-31 / HU-26: Validación de continuidad en selección de franjas horarias.
 * Las franjas deben ser estrictamente consecutivas sin huecos temporales (gaps).
 */
export function validateContinuousSlots(slots: DynamicTimeSlot[]): {
  valid: boolean;
  message?: string;
} {
  if (slots.length <= 1) return { valid: true };

  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (current && next && current.endTime !== next.startTime) {
      return {
        valid: false,
        message: 'Las reservas múltiples deben ser continuas (sin huecos intermedios entre horarios).',
      };
    }
  }

  return { valid: true };
}

/**
 * TSK-FE-31: Cálculo reactivo de precio con subtotal y descuento del 30% para socios.
 */
export function calculateMultiSlotPricing(
  basePricePerHour: number,
  slotCount: number,
  isMember: boolean = false,
): {
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
} {
  const count = Math.max(0, slotCount);
  const subtotal = basePricePerHour * count;
  const discountPct = isMember ? 30 : 0;
  const discountAmount = Math.round(subtotal * (discountPct / 100));
  const total = subtotal - discountAmount;

  return {
    subtotal,
    discountPct,
    discountAmount,
    total,
  };
}
