export type EstadoTorneo =
  | 'BORRADOR'
  | 'INSCRIPCIONES_ABIERTAS'
  | 'EN_CURSO'
  | 'FINALIZADO'
  | 'CANCELADO';
export type TournamentStatus = EstadoTorneo;

export type EstadoInscripcionTorneo =
  | 'PENDIENTE_PAGO'
  | 'CONFIRMADA'
  | 'CANCELADA';
export type TournamentRegistrationStatus = EstadoInscripcionTorneo;

export interface Torneo {
  id: string;
  adminId: string;
  categoriaId: number;
  titulo: string;
  descripcion: string;
  nivel: string;
  fechaInicio: Date;
  fechaFin: Date;
  cuposTotales: number;
  cuposOcupados: number;
  precioInscripcion: number;
  estado: EstadoTorneo;
  eliminadoEn?: Date | null;
}
export type Tournament = Torneo;

export interface InscripcionTorneo {
  id: string;
  torneoId: string;
  usuarioId: string;
  nombrePareja?: string | null;
  estado: EstadoInscripcionTorneo;
  creadoEn: Date;
  actualizadoEn?: Date;
}
export type TournamentRegistration = InscripcionTorneo;
