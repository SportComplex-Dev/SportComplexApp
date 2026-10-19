export type EstadoReservaAdmin =
  | 'CONFIRMADA'
  | 'PENDIENTE_PAGO'
  | 'EXPIRADA'
  | 'CANCELADA_ADMINISTRATIVA'
  | 'CANCELADA_PAGO'
  | 'CANCELADA'

export interface AdminBookingItem {
  id: string
  disponibilidadId: string
  titularId: string
  vendedorId: string | null
  pagoId: string | null
  membresiaId: number | null
  inhabilitacionId: number | null
  cantidadCupos: number
  canal: string
  estado: EstadoReservaAdmin
  subtotal: number
  descuentoPct: number
  total: number
  expiraEn: string | Date | null
  creadoEn: string | Date
  titular: {
    id: string
    nombre: string
    correo: string
    avatar: string | null
  }
  disponibilidad: {
    id: string
    fecha: string | Date
    servicioId: number
    franjaId: number
    servicio: {
      id: number
      nombre: string
      tarifa: number
      categoria?: {
        id: number
        nombre: string
        tipo: string
      }
    }
    franja: {
      id: number
      diaSemana: number
      horaInicio: string | Date
      horaFin: string | Date
    }
  }
  tickets?: Array<{
    id: string
    codigo: string
    estado: string
    titularNombre: string
  }>
}

export interface ServiceOccupancyMetric {
  serviceId: number
  serviceName: string
  count: number
}

export interface AdminBookingMetrics {
  todayTotal: number
  confirmedCount: number
  pendingCount: number
  byService: ServiceOccupancyMetric[]
}

export interface AdminBookingsResponse {
  items: AdminBookingItem[]
  total: number
  limit: number
  offset: number
  metrics: AdminBookingMetrics
}

export interface AdminBookingFiltersState {
  search: string
  status: string
  serviceId: string
  dateFrom: string
  dateTo: string
  page: number
  limit: number
}
