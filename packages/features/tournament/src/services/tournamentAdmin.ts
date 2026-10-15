import type { TorneoAdminItem } from '../types'

export const TIMEZONE_BOGOTA = 'America/Bogota'

/**
 * Convierte un objeto Date o ISO string a formato local 'YYYY-MM-DDTHH:mm'
 * forzando estrictamente la zona horaria legal de Colombia (America/Bogota, UTC-5).
 */
export function toDatetimeLocal(isoOrDate: string | Date | undefined): string {
  if (!isoOrDate) return ''
  const d = new Date(isoOrDate)
  if (isNaN(d.getTime())) return ''

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BOGOTA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  const parts = formatter.formatToParts(d)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`
}

/**
 * Convierte un string de input 'YYYY-MM-DDTHH:mm' a ISO UTC preservando el huso de Colombia (UTC-5).
 */
export function parseDatetimeLocalToUtcIso(datetimeStr: string): string {
  if (!datetimeStr) return ''
  const trimmed = datetimeStr.trim()
  if (trimmed.endsWith('Z') || trimmed.includes('+') || (trimmed.includes('-') && trimmed.length > 19)) {
    return new Date(trimmed).toISOString()
  }
  const isoWithBogotaOffset = trimmed.length === 16 ? `${trimmed}:00-05:00` : `${trimmed}-05:00`
  return new Date(isoWithBogotaOffset).toISOString()
}

/**
 * Mapea códigos de error conocidos de la API de torneos a mensajes legibles por el usuario.
 */
export function mapTournamentApiError(code?: string, defaultMsg?: string): string {
  if (code === 'COURT_SLOT_CONFLICT') {
    return 'Conflicto de disponibilidad: Una de las pistas seleccionadas ya tiene reservas activas en ese horario.'
  }
  if (code === 'ALREADY_REGISTERED') {
    return 'Ya te encuentras formalmente inscrito en este torneo deportivo.'
  }
  return defaultMsg || 'Error al guardar el torneo en el servidor.'
}

/**
 * Cálculo agregado y reactivo de KPIs para torneos administrativos.
 */
export function calculateTournamentKPIs(tournamentsList: TorneoAdminItem[]) {
  const total = tournamentsList.length
  const abiertas = tournamentsList.filter((t) => t.estado === 'INSCRIPCIONES_ABIERTAS').length
  const enCurso = tournamentsList.filter((t) => t.estado === 'EN_CURSO').length
  const inscripciones = tournamentsList.reduce(
    (acc, t) => acc + (t.cuposOcupados ?? t._count?.inscripciones ?? 0),
    0
  )
  return { total, abiertas, enCurso, inscripciones }
}
