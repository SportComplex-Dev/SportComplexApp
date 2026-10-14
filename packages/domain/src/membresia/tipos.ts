export type EstadoMembresia = 'VIGENTE' | 'VENCIDA' | 'CANCELADA';
export type MembershipStatus = EstadoMembresia;

export type PeriodicidadPlan = 'SEMANAL' | 'MENSUAL' | 'ANUAL';
export type PlanPeriodicity = PeriodicidadPlan;

export interface PlanMembresia {
  id: number;
  nombre: string;
  periodicidad: PeriodicidadPlan;
  precio: number;
  descuentoPct: number;
  activo: boolean;
}
export type MembershipPlan = PlanMembresia;

export interface Membresia {
  id: string;
  usuarioId: string;
  planId: number;
  estado: EstadoMembresia;
  fechaInicio: Date;
  fechaFin: Date;
  autoRenovacion: boolean;
}
export type Membership = Membresia;
