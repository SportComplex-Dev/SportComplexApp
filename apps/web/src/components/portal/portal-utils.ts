import QRCode from 'qrcode'
import { formatMoney, type Booking } from '@sportcomplex/core'

export interface ApiBookingHistoryItem {
  id: string
  estado: string
  cantidadCupos?: number
  total?: number | string
  ticketQr?: { codigoUuid?: string } | null
  disponibilidad?: {
    fecha?: string | Date
    franja?: { horaInicio: string; horaFin: string } | null
    servicio?: { nombre: string; tipo: string } | null
  } | null
  pago?: { metodo?: string; referenciaExterna?: string } | null
}

/**
 * Formatea franjas horarias en formato 12 horas con sufijo a. m. / p. m.
 */
export function formatSlotTime(raw: string | undefined): string {
  if (!raw) return '07:00 a. m.'
  if (raw.includes('T')) {
    const timePart = raw.split('T')[1]?.slice(0, 5)
    if (timePart) {
      const [h, m] = timePart.split(':').map(Number)
      const period = h >= 12 ? 'p. m.' : 'a. m.'
      const hour12 = h % 12 || 12
      return `${hour12}:${String(m).padStart(2, '0')} ${period}`
    }
  }
  return raw
}

/**
 * Clasifica reservas en 3 pestañas según requerimiento funcional RF-12:
 * - Activas: Confirmadas o Pendientes de pago
 * - Historial: Usadas o Expiradas
 * - Canceladas: Canceladas administrativamente o por usuario
 */
export function clasificarReservas(reservas: Booking[]) {
  const activas = reservas.filter(
    (b) => b.status === 'Confirmada' || b.status === 'CONFIRMADA' || b.status === 'Pendiente'
  )
  const historial = reservas.filter(
    (b) => b.status === 'Usada' || (b.status as string) === 'Expirada' || (b.status as string) === 'EXPIRADA'
  )
  const canceladas = reservas.filter(
    (b) => b.status === 'Cancelada' || b.status === 'CANCELADA_ADMINISTRATIVA'
  )
  return { activas, historial, canceladas }
}

/**
 * Obtiene la próxima reserva confirmada vigente para el banner destacado.
 * Filtra reservas con fechas pasadas (b.date < today) para evitar fijar reservas vencidas.
 */
export function obtenerProximaReserva(reservas: Booking[], today?: string): Booking | null {
  const candidatas = reservas.filter((b) => {
    if (b.status !== 'Confirmada') return false
    if (!today) return true
    return b.date >= today
  })

  if (candidatas.length === 0) return null

  return [...candidatas].sort((a, b) => a.date.localeCompare(b.date))[0]
}

/**
 * Desglose fiscal y financiero del Comprobante Digital / Voucher (RN-14).
 * Aplica IVA colombiano del 19%.
 */
export function calcularDesgloseComprobante(amount: number) {
  const subtotal = Math.round(amount / 1.19)
  const iva = amount - subtotal
  return {
    subtotal,
    iva,
    total: amount,
    subtotalFormateado: formatMoney(subtotal),
    ivaFormateado: formatMoney(iva),
    totalFormateado: formatMoney(amount),
  }
}

/**
 * Genera Data URL en formato imagen PNG de un código QR estándar (RF-10 / RF-13)
 * compatible con torniquetes ópticos y escáneres de acceso.
 */
export async function generarQRDataUrl(code: string, width = 280): Promise<string> {
  return QRCode.toDataURL(code, {
    width,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#091b13',
      light: '#ffffff',
    },
  })
}

/**
 * Determina el saludo contextual según la hora oficial en Bogotá UTC-5 (RNF-02).
 */
export function obtenerSaludoContextual(horaBogota: number): string {
  if (horaBogota < 12) return 'Buenos días'
  if (horaBogota < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * Carga el historial de reservas de cliente desde el endpoint /api/bookings/history (TSK-BE-13).
 */
export async function fetchCustomerBookingHistory(
  clientName = 'Cliente',
  limit = 20
): Promise<Booking[]> {
  const statuses = ['CONFIRMADA', 'EXPIRADA', 'CANCELADA_ADMINISTRATIVA']
  const requests = statuses.map((status) =>
    fetch(`/api/bookings/history?status=${status}&limit=${limit}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
  )

  const results = await Promise.all(requests)
  const merged: Booking[] = []

  results.forEach((res) => {
    if (res?.success && Array.isArray(res.data?.items)) {
      res.data.items.forEach((item: ApiBookingHistoryItem) => {
        const statusMap: Record<string, Booking['status']> = {
          CONFIRMADA: 'Confirmada',
          EXPIRADA: 'Usada',
          CANCELADA_ADMINISTRATIVA: 'Cancelada',
        }
        const inicio = formatSlotTime(item.disponibilidad?.franja?.horaInicio)
        const fin = formatSlotTime(item.disponibilidad?.franja?.horaFin)
        const rawTotal =
          typeof item.total === 'number'
            ? item.total
            : typeof item.total === 'string'
              ? parseFloat(item.total)
              : 45000
        const safeTotal = isNaN(rawTotal) ? 45000 : rawTotal

        merged.push({
          id: item.id,
          code: item.ticketQr?.codigoUuid
            ? `ALT-${item.ticketQr.codigoUuid.slice(0, 8).toUpperCase()}`
            : `ALT-${item.id.slice(0, 8).toUpperCase()}`,
          client: clientName,
          category: item.disponibilidad?.servicio?.tipo?.toLowerCase() ?? 'canchas',
          service: item.disponibilidad?.servicio?.nombre ?? 'Espacio deportivo',
          sede: 'Laureles',
          date: item.disponibilidad?.fecha
            ? String(item.disponibilidad.fecha).slice(0, 10)
            : '2026-10-09',
          time: item.disponibilidad?.franja ? `${inicio} — ${fin}` : '07:00 a. m.',
          attendees: item.cantidadCupos ?? 1,
          amount: safeTotal,
          status: statusMap[item.estado] ?? 'Confirmada',
          paymentMethod: item.pago?.metodo ?? 'card',
          transactionRef: item.pago?.referenciaExterna ?? undefined,
        })
      })
    }
  })

  return merged
}
