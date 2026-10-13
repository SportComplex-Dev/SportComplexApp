import { formatMoney } from "@sportcomplex/core";

export interface PlanMembresiaDTO {
  id: number;
  nombre: string;
  periodicidad: "SEMANAL" | "MENSUAL" | "ANUAL";
  precio: number | string;
  descuentoPct: number | string;
  stripePriceId?: string | null;
  activo: boolean;
}

export interface MembresiaActivaDTO {
  id: number;
  estado: "VIGENTE" | "VENCIDA" | "CANCELADA";
  fechaInicio: string | Date;
  proximaRenovacion: string | Date;
  plan: PlanMembresiaDTO;
}

export interface MembershipsApiResponse {
  planes: PlanMembresiaDTO[];
  membresiaActiva: MembresiaActivaDTO | null;
}

export interface PlanDisplayBreakdown {
  id: number;
  nombre: string;
  periodicidad: "SEMANAL" | "MENSUAL" | "ANUAL";
  periodicidadLabel: string;
  precio: number;
  precioFormateado: string;
  porcentajeDescuento: number; // Porcentaje de descuento (30%) que el plan confiere en reservas
  // Campos de compatibilidad monetaria con la tarifa oficial
  precioOriginal: number;
  precioOriginalFormateado: string;
  montoDescuento: number;
  montoDescuentoFormateado: string;
  precioConDescuento: number;
  precioConDescuentoFormateado: string;
  ahorroAnualLabel?: string;
  beneficios: string[];
  popular?: boolean;
}

/**
 * Beneficios descriptivos estándar de cada plan en el complejo
 */
export const BENEFICIOS_POR_PERIODICIDAD: Record<string, string[]> = {
  SEMANAL: [
    "30 % de descuento automático en alquiler de pistas y canchas",
    "Acceso libre ilimitado a Gimnasio durante la semana",
    "Sin cláusula de permanencia, renovación semana a semana",
    "Pase de acceso QR digital para torniquetes ópticos",
    "Reserva preferente con hasta 48 horas de anticipación",
  ],
  MENSUAL: [
    "30 % de descuento automático en alquiler de pistas y canchas",
    "Acceso ilimitado a Gimnasio, Piscina y Zona Húmeda",
    "1 pase de invitado de cortesía cada mes",
    "Toalla deportiva limpia en cada visita",
    "Reserva preferente con 7 días de anticipación",
    "10 % de descuento en cafetería & bar del club",
  ],
  ANUAL: [
    "30 % de descuento garantizado todo el año en cualquier reserva",
    "Acceso total VIP: Gimnasio, Piscina, Sauna, Turco & Jacuzzi",
    "Casillero privado con cerradura digital asignado",
    "3 pases de invitado de cortesía al mes",
    "Inscripción prioritaria a torneos y eventos deportivos",
    "Ventana VIP de reservas anticipadas de hasta 15 días",
    "Servicio de conserjería deportiva personalizada",
  ],
};

/**
 * Presenta la información financiera transparente del plan respetando
 * la tarifa autoritativa de la base de datos (y Stripe) y destacando el 30%
 * de descuento que el usuario recibe en sus reservas deportivas (HU-20 / RF-16).
 */
export function calcularDesglosePlan(
  plan: PlanMembresiaDTO,
  _esSocioVigente = false,
): PlanDisplayBreakdown {
  const precioNumerico =
    typeof plan.precio === "number" ? plan.precio : parseFloat(String(plan.precio)) || 0;
  const pct =
    typeof plan.descuentoPct === "number"
      ? plan.descuentoPct
      : parseFloat(String(plan.descuentoPct)) || 30;

  // Respetar la periodicidad oficial del Enum de base de datos
  const periodicidadKey: "SEMANAL" | "MENSUAL" | "ANUAL" = plan.periodicidad;

  const periodicidadLabels: Record<string, string> = {
    SEMANAL: "Semana",
    MENSUAL: "Mes",
    ANUAL: "Año",
  };

  const periodicidadLabel = periodicidadLabels[periodicidadKey] || "Periodo";
  const beneficios = BENEFICIOS_POR_PERIODICIDAD[periodicidadKey] || [
    "30 % de descuento en todas las reservas del complejo",
    "Acceso a instalaciones deportivas y torniquetes QR",
  ];

  const popular = periodicidadKey === "MENSUAL";

  let ahorroAnualLabel: string | undefined;
  if (periodicidadKey === "ANUAL") {
    ahorroAnualLabel = "Ahorras hasta 2 meses comparado con mensualidad recurrente";
  }

  const precioFormateado = formatMoney(precioNumerico);

  return {
    id: plan.id,
    nombre: plan.nombre,
    periodicidad: periodicidadKey,
    periodicidadLabel,
    precio: precioNumerico,
    precioFormateado,
    porcentajeDescuento: pct,
    // Valores consistentes con el cobro de Stripe
    precioOriginal: precioNumerico,
    precioOriginalFormateado: precioFormateado,
    montoDescuento: 0,
    montoDescuentoFormateado: formatMoney(0),
    precioConDescuento: precioNumerico,
    precioConDescuentoFormateado: precioFormateado,
    ahorroAnualLabel,
    beneficios,
    popular,
  };
}

/**
 * Realiza la petición para iniciar la sesión de suscripción en Stripe Checkout.
 */
export async function iniciarSuscripcionStripe(planId: number): Promise<{
  success: boolean;
  url?: string;
  sessionId?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch("/api/memberships/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId,
        successUrl: origin ? `${origin}/portal/membership?success=true&plan_id=${planId}` : undefined,
        cancelUrl: origin ? `${origin}/portal/membership?cancelled=true` : undefined,
      }),
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401 || data?.error?.code === "UNAUTHORIZED") {
      return {
        success: false,
        errorCode: "UNAUTHORIZED",
        errorMessage: "Debes iniciar sesión para suscribirte a una membresía.",
      };
    }

    if (!res.ok || !data?.success) {
      return {
        success: false,
        errorCode: data?.error?.code || "SUBSCRIBE_ERROR",
        errorMessage: data?.error?.message || "No se pudo iniciar el proceso de suscripción.",
      };
    }

    return {
      success: true,
      url: data.data?.checkout?.url,
      sessionId: data.data?.checkout?.sessionId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      errorCode: "NETWORK_ERROR",
      errorMessage:
        err instanceof Error ? err.message : "Error de comunicación con el servidor.",
    };
  }
}
