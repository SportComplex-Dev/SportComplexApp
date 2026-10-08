// Modelos de dominio agnósticos al framework (ARCHITECTURE §6.2)

export type Role = "Administrador" | "Empleado_Vendedor" | "Empleado_Lector" | "Cliente";
export type AccountStatus = "Pendiente" | "Activo" | "Inactivo" | "Temporalmente_Inactivo";
export type BookingStatus = "BLOQUEADA_TTL" | "CONFIRMADA" | "CANCELADA_ADMINISTRATIVA";
export type TicketStatus = "EMITIDO" | "USADO";
export type MembershipStatus = "VIGENTE" | "VENCIDA" | "CANCELADA";
export type PoolModality = "Publica" | "Privada";

export interface MoneyCents {
  amountCents: number;
  currency: "COP";
}

export const TIMEZONE = "America/Bogota" as const;
export const BOOKING_WINDOW_DAYS = 15 as const;
export const CHECKOUT_TTL_MINUTES = 30 as const;
export const MEMBERSHIP_DISCOUNT_RATE = 0.3 as const;

export * from "./catalog";

export const roleHome: Record<Role, string> = {
  Administrador: '/admin/dashboard',
  Empleado_Vendedor: '/pos',
  Empleado_Lector: '/scanner',
  Cliente: '/portal',
};