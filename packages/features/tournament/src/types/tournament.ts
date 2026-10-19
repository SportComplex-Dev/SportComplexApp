export type EstadoTorneoTipo =
  | 'BORRADOR'
  | 'INSCRIPCIONES_ABIERTAS'
  | 'EN_CURSO'
  | 'FINALIZADO'
  | 'CANCELADO'

export type EstadoInscripcionTipo =
  | 'CONFIRMADA'
  | 'PENDIENTE_PAGO'
  | 'CANCELADA'

export interface BloqueoFormItem {
  servicioId: number
  horaInicio: string
  horaFin: string
}

export interface TournamentFormData {
  id?: string | undefined
  titulo: string
  descripcion: string
  categoriaId: number
  nivel: string
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  precioInscripcion: number
  estado: EstadoTorneoTipo
  bloqueos: BloqueoFormItem[]
}

export interface TournamentEditInput {
  id?: string | undefined
  titulo?: string | undefined
  descripcion?: string | null | undefined
  categoriaId?: number | undefined
  nivel?: string | undefined
  fechaInicio?: string | Date | undefined
  fechaFin?: string | Date | undefined
  cuposTotales?: number | undefined
  precioInscripcion?: number | string | undefined
  estado?: EstadoTorneoTipo | undefined
  bloqueos?: Array<{
    servicioId: number
    horaInicio?: string | Date
    horaFin?: string | Date
  }>
}

export interface BloqueoDetailItem {
  id?: number
  servicioId: number
  servicio?: { nombre: string }
  horaInicio?: string
  horaFin?: string
}

export interface InscripcionDetailItem {
  id: string
  estado: string
  nombrePareja?: string | null
  ticketEstado?: string
  creadoEn?: string
  usuario?: {
    nombre?: string
    correo?: string
  }
}

export interface TournamentDetailData {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { nombre: string }
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposOcupados: number
  precioInscripcion: number | string
  estado: string
  bloqueos?: BloqueoDetailItem[]
  inscripciones?: InscripcionDetailItem[]
}

export interface TournamentRegisterTarget {
  id: string
  titulo: string
  descripcion?: string | null
  nivel: string
  categoria?: { id?: number; nombre: string }
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposDisponibles?: number
  cuposOcupados: number
  precioInscripcion: number | string
  yaInscrito?: boolean
  bloqueos?: Array<{
    id?: number
    servicioId?: number
    servicio?: { id?: number; nombre: string }
    horaInicio?: string
    horaFin?: string
  }>
  miInscripcion?: {
    id: string
    estado: string
    nombrePareja?: string | null
    ticketCodigoUuid?: string | null
    ticketQrPayload?: string | null
  } | null
}

export interface IssuedTournamentTicket {
  id?: string
  codigo?: string
  codigoUuid?: string
  firma?: string
  qrPayload?: string
}

export interface PublicTournamentDetailData extends TournamentRegisterTarget {
  court?: string
  sede?: string
  tone?: 'lime' | 'blue' | 'orange' | 'purple'
  bloqueos?: Array<{
    servicio?: { nombre: string }
    horaInicio?: string
    horaFin?: string
  }>
}

export interface TorneoAdminItem {
  id: string
  titulo: string
  descripcion: string | null
  categoriaId: number
  categoria?: { id: number; nombre: string }
  nivel: string
  fechaInicio: string
  fechaFin: string
  cuposTotales: number
  cuposOcupados: number
  precioInscripcion: number | string
  estado: EstadoTorneoTipo
  bloqueos?: Array<{
    id: number
    servicioId: number
    horaInicio: string
    horaFin: string
    servicio?: { nombre: string }
  }>
  _count?: { inscripciones: number }
}

/**
 * Shared type for portal ticket consumption.
 * Originally from apps/web/src/app/(customer)/portal/tickets/types.ts
 */
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
