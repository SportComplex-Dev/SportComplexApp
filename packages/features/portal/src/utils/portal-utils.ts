import QRCode from 'qrcode'
import { formatMoney, TIMEZONE, type Booking } from '@sportcomplex/core'

export type PortalTicket = Booking & {
  accessWindowStart?: string | undefined
  accessWindowEnd?: string | undefined
  ticketIssued?: boolean | undefined
}

export type AccessWindowStatus = 'UPCOMING' | 'OPEN' | 'EXPIRED'

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
      const period = (h ?? 0) >= 12 ? 'p. m.' : 'a. m.'
      const hour12 = (h ?? 0) % 12 || 12
      return `${hour12}:${String(m ?? 0).padStart(2, '0')} ${period}`
    }
    return raw
  }
  return raw
}

function getWindowTimes(ticket: Pick<PortalTicket, 'date' | 'time' | 'accessWindowStart' | 'accessWindowEnd'>): {
  start: string
  end: string
} | null {
  const parseTime = (value: string | undefined): string | null => {
    if (!value) return null
    const match = value.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i)
    if (!match) return null

    let hour = Number(match[1])
    const minute = Number(match[2])
    const second = Number(match[3] ?? 0)
    const meridiem = match[4]?.replace(/\s/g, '').replace(/\./g, '').toLowerCase()
    if (hour > 23 || minute > 59 || second > 59) return null
    if (meridiem) {
      if (hour < 1 || hour > 12) return null
      hour = hour % 12 + (meridiem === 'pm' ? 12 : 0)
    }
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
  }

  const timeMatches = [...ticket.time.matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/ig)]
  const start = parseTime(ticket.accessWindowStart) ?? parseTime(timeMatches[0]?.[0])
  const end = parseTime(ticket.accessWindowEnd) ?? parseTime(timeMatches[1]?.[0])
  return start && end ? { start, end } : null
}

function localDateTimeKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
}

export function getAccessWindowStatus(
  ticket: Pick<PortalTicket, 'date' | 'time' | 'accessWindowStart' | 'accessWindowEnd'>,
  now = new Date(),
): AccessWindowStatus | null {
  const times = getWindowTimes(ticket)
  if (!times || !/^\d{4}-\d{2}-\d{2}$/.test(ticket.date) || Number.isNaN(now.getTime())) return null

  const start = `${ticket.date}T${times.start}`
  const end = `${ticket.date}T${times.end}`
  const current = localDateTimeKey(now)
  if (current < start) return 'UPCOMING'
  if (current <= end) return 'OPEN'
  return 'EXPIRED'
}

export function getAccessWindowLabel(
  ticket: Pick<PortalTicket, 'date' | 'time' | 'accessWindowStart' | 'accessWindowEnd'>,
): string | null {
  const times = getWindowTimes(ticket)
  return times ? `${times.start.slice(0, 5)} - ${times.end.slice(0, 5)}` : null
}

/**
 * Clasifica reservas en 3 pestañas según requerimiento funcional RF-12:
 * - Activas: Confirmadas o Pendientes de pago
 * - Historial: Usadas o Expiradas
 * - Canceladas: Canceladas administrativamente o por usuario
 */
export function clasificarReservas<T extends Booking>(reservas: T[]) {
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

  return [...candidatas].sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
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

export interface ReceiptApiResponse {
  membrete?: {
    entidad?: string
    nit?: string | null
    direccion?: string | null
    telefono?: string | null
    correo?: string | null
    pie?: string | null
  }
  reserva?: {
    id: string
    estado: string
    subtotal: string
    total: string
    descuentoPct?: string
  }
  ticket?: {
    id: string
    estado: 'EMITIDO' | 'USADO'
  } | null
  servicio?: {
    nombre: string
    fecha: string
    horaInicio: string
    horaFin: string
  }
  titular?: {
    nombre: string
    correo?: string | null
  }
  qr?: {
    payload: string
    dataUrl: string
  } | null
}

/**
 * Consulta la estructura y datos oficiales del comprobante emitido desde el backend (TSK-BE-19).
 */
export async function fetchReceiptData(reservaId: string): Promise<ReceiptApiResponse | null> {
  if (!reservaId) return null
  try {
    const res = await fetch(`/api/pdf/receipt?reservaId=${encodeURIComponent(reservaId)}&destinatario=PORTAL`)
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data) {
        return json.data as ReceiptApiResponse
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Sanitiza nombres de archivos para descarga evitando caracteres conflictivos en sistemas de archivos.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9_-]/g, '_')
}

/**
 * Carga el historial de reservas de cliente desde el endpoint /api/bookings/history (TSK-BE-13).
 */
export async function fetchCustomerBookingHistory(
  clientName = 'Cliente',
  limit = 20
): Promise<PortalTicket[]> {
  const statuses = ['CONFIRMADA', 'EXPIRADA', 'CANCELADA_ADMINISTRATIVA']
  const requests = statuses.map((status) =>
    fetch(`/api/bookings/history?status=${status}&limit=${limit}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
  )

  const results = await Promise.all(requests)
  const merged: PortalTicket[] = []

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

        const ticket: PortalTicket = {
          id: item.id,
          ticketIssued: Boolean(item.ticketQr?.codigoUuid),
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
          status: (item.estado in statusMap ? statusMap[item.estado] : undefined) ?? 'Confirmada',
          paymentMethod: item.pago?.metodo ?? 'card',
        }
        if (item.disponibilidad?.franja?.horaInicio) {
          ticket.accessWindowStart = normalizeAccessTime(item.disponibilidad.franja.horaInicio)
        }
        if (item.disponibilidad?.franja?.horaFin) {
          ticket.accessWindowEnd = normalizeAccessTime(item.disponibilidad.franja.horaFin)
        }
        if (item.pago?.referenciaExterna) {
          ticket.transactionRef = item.pago.referenciaExterna
        }
        merged.push(ticket)
      })
    }
  })

  return merged
}

function normalizeAccessTime(raw: string): string {
  const value = raw.includes('T') ? raw.slice(11, 19) : raw
  return value.length === 5 ? `${value}:00` : value.slice(0, 8)
}
