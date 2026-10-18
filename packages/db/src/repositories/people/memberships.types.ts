import type { EstadoMembresia } from "@prisma/client";

export interface CreateMembershipInput {
  usuarioId: string;
  planId: number;
  stripeSubscriptionId?: string | null;
  fechaInicio?: Date;
  proximaRenovacion?: Date;
  estado?: EstadoMembresia;
}

export interface AdminMembershipSegment {
  id: string;
  nombre: string;
  fechaInicio?: Date;
  fechaFin?: Date;
}

export interface AdminMembershipOverview {
  segments: {
    active: AdminMembershipSegment[];
    none: AdminMembershipSegment[];
    expired: AdminMembershipSegment[];
  };
  metrics: {
    newMembersLast30Days: number;
    renewalPercentage: number;
  };
}
