export type TabType = 'activas' | 'historial' | 'canceladas' | 'torneos'

export interface UserTournamentItem {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { id: number; nombre: string }
  fechaInicio: string
  fechaFin: string
  precioInscripcion: number | string
  miInscripcion?: {
    id: string
    estado: string
    nombrePareja?: string | null
    ticketCodigoUuid?: string | null
    ticketQrPayload?: string | null
    ticket?: { id?: string; codigo?: string; codigoUuid?: string; qrPayload?: string }
  }
}
