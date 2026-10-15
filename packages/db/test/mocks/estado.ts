// Estado y tipos en memoria para MockPrismaClient
export interface MockCategoria {
  id: number;
  nombre: string;
  tipo: string;
}

export interface MockFranja {
  id: number;
  servicioId: number;
  diaSemana: number;
  horaInicio: Date;
  horaFin: Date;
}

export interface MockDisponibilidad {
  id: bigint;
  servicioId: number;
  franjaId: number;
  fecha: Date;
  cuposTotales: number;
  cuposOcupados: number;
  bloqueadaMantenimiento: boolean;
  servicio?: MockServicio;
  franja?: MockFranja;
}

export interface MockServicio {
  id: number;
  categoriaId: number;
  nombre: string;
  capacidadMaxima: number;
  tarifa: number | string;
  modalidad: string;
  tipoPiscina: string | null;
  estado: string;
}

export interface MockReserva {
  id: string;
  disponibilidadId: bigint;
  estado: string;
  titularId?: string;
  vendedorId?: string | null;
  cantidadCupos?: number;
  expiraEn?: Date | null;
  inhabilitacionId?: number | null;
  pagoId?: string | null;
  creadoEn?: Date;
  canal?: string;
  subtotal?: number | string;
  descuentoPct?: number | string;
  total?: number | string;
}

export interface MockPago {
  id: string;
  usuarioId: string;
  membresiaId?: number | null;
  tipo: string;
  stripePaymentIntentId: string;
  monto: string | number;
  estado: string;
  creadoEn?: Date;
}

export interface MockMembresia {
  id: number;
  usuarioId: string;
  planId?: number;
  estado: string;
  fechaInicio?: Date;
  proximaRenovacion?: Date;
  stripeSubscriptionId?: string | null;
}

export interface MockPlanMembresia {
  id: number;
  nombre: string;
  periodicidad: string;
  precio: number | string;
  descuentoPct: number | string;
  stripePriceId?: string | null;
  activo: boolean;
}

export interface MockUsuario {
  id: string;
  nombre: string;
  correo?: string;
  estado?: string;
  deletedAt?: Date | null;
  rolId?: number;
  rolNombre?: string;
  creadoEn?: Date;
  passwordHash?: string;
}

export interface MockTicketQr {
  id: string;
  reservaId: string;
  codigoUuid: string;
  usadoPor: string | null;
  estado: string;
  usadoEn: Date | null;
  emitidoEn?: Date;
}

export interface MockLecturaAcceso {
  id: bigint;
  ticketId: string;
  empleadoId: string;
  asignacionId: number | null;
  modo: string;
  resultado: string;
  fechaHora: Date;
}

export interface MockAsignacionPuesto {
  id: number;
  empleadoId: string;
  servicioId: number;
  inicioTurno: Date;
  finTurno: Date;
}

export interface MockSequences {
  catIdSeq: number;
  servIdSeq: number;
  franjaIdSeq: number;
  dispIdSeq: bigint;
  reservaIdSeq: number;
  planIdSeq: number;
  membresiaIdSeq: number;
  pagoIdSeq: number;
  lecturaIdSeq: bigint;
  asignacionIdSeq: number;
}

export interface MockRol {
  id: number;
  nombre: string;
}

export interface MockState {
  categorias: MockCategoria[];
  roles: MockRol[];
  servicios: MockServicio[];
  franjas: MockFranja[];
  disponibilidades: MockDisponibilidad[];
  reservas: MockReserva[];
  pagos: MockPago[];
  membresias: MockMembresia[];
  planesMembresia: MockPlanMembresia[];
  usuarios: MockUsuario[];
  tickets: MockTicketQr[];
  lecturas: MockLecturaAcceso[];
  asignaciones: MockAsignacionPuesto[];
  inhabilitaciones: Array<Record<string, unknown>>;
  torneos: any[];
  bloqueosTorneo: any[];
  inscripcionesTorneo: any[];
  seq: MockSequences;
}

export function crearEstadoInicial(): MockState {
  return {
    categorias: [],
    roles: [
      { id: 1, nombre: "ADMIN" },
      { id: 2, nombre: "VENDEDOR" },
      { id: 3, nombre: "LECTOR" },
      { id: 4, nombre: "CLIENTE" },
    ],
    servicios: [],
    franjas: [],
    disponibilidades: [],
    reservas: [],
    pagos: [],
    membresias: [],
    planesMembresia: [
      {
        id: 1,
        nombre: "Plan Semanal",
        periodicidad: "SEMANAL",
        precio: 50000,
        descuentoPct: 30.0,
        stripePriceId: "price_semanal_test",
        activo: true,
      },
      {
        id: 2,
        nombre: "Plan Mensual Estándar",
        periodicidad: "MENSUAL",
        precio: 180000,
        descuentoPct: 30.0,
        stripePriceId: "price_mensual_test",
        activo: true,
      },
      {
        id: 3,
        nombre: "Plan Anual Premium",
        periodicidad: "ANUAL",
        precio: 1800000,
        descuentoPct: 30.0,
        stripePriceId: "price_anual_test",
        activo: true,
      },
    ],
    usuarios: [],
    tickets: [],
    lecturas: [],
    asignaciones: [],
    inhabilitaciones: [],
    torneos: [],
    bloqueosTorneo: [],
    inscripcionesTorneo: [],
    seq: {
      catIdSeq: 1,
      servIdSeq: 1,
      franjaIdSeq: 1,
      dispIdSeq: 1n,
      reservaIdSeq: 1,
      planIdSeq: 4,
      membresiaIdSeq: 1,
      pagoIdSeq: 1,
      lecturaIdSeq: 1n,
      asignacionIdSeq: 1,
    },
  };
}
