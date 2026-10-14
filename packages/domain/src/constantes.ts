// Constantes canónicas globales del dominio SportComplex (español camelCase con aliases heredados)

export const zonaHoraria = "America/Bogota" as const;
export const TIMEZONE = zonaHoraria;

export const diasVentanaReserva = 15 as const;
export const BOOKING_WINDOW_DAYS = diasVentanaReserva;

export const minutosTtlCheckout = 30 as const;
export const CHECKOUT_TTL_MINUTES = minutosTtlCheckout;

export const tasaDescuentoMembresia = 0.3 as const;
export const MEMBERSHIP_DISCOUNT_RATE = tasaDescuentoMembresia;
