/**
 * Utilidades de formato y cálculo para la gestión de contingencias administrativas (RF-19 / TSK-FE-22).
 */

/**
 * Formatea una fecha de reserva (@db.Date de Postgres / Prisma) forzando UTC
 * para evitar el desfase de un día (off-by-one) en zonas horarias como America/Bogota (UTC-5).
 */
export function formatIncidentDate(val: string | Date | null | undefined): string {
  if (!val) return ''
  const d = typeof val === 'string' ? new Date(val) : val
  if (isNaN(d.getTime())) return String(val)
  return d.toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Formatea una hora de franja (@db.Time de Postgres / Prisma) forzando UTC
 * para evitar desplazamientos horarios locales (ej. 5 horas atrás en UTC-5).
 */
export function formatIncidentHour(val: string | Date | null | undefined): string {
  if (!val) return ''
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val)
      return d.toLocaleTimeString('es-CO', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
    return val.substring(0, 5)
  }
  return val.toLocaleTimeString('es-CO', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Valida la longitud y contenido del motivo de inhabilitación (entre 3 y 255 caracteres).
 */
export function isIncidentReasonValid(motivo: string): boolean {
  const trimmed = motivo.trim()
  return trimmed.length >= 3 && trimmed.length <= 255
}

/**
 * Agrupa y calcula el impacto de las reservas en riesgo de cancelación:
 * total de reservas, total de cupos y total de clientes únicos afectados.
 */
export function calcularImpactoContingencia(
  reservas: Array<{ usuarioId: string; cantidadCupos: number }>,
) {
  const totalCupos = reservas.reduce((acc, r) => acc + (r.cantidadCupos || 0), 0)
  const uniqueUsers = new Set(reservas.map((r) => r.usuarioId))

  return {
    totalReservas: reservas.length,
    totalCupos,
    totalClientesAfectados: uniqueUsers.size,
  }
}
