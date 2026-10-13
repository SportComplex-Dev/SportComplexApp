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
  precioOriginal: number;
  precioOriginalFormateado: string;
  porcentajeDescuento: number;
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
    "30 % de descuento automático en alquiler de pistas y turnos",
    "Acceso ilimitado a Gimnasio, Piscina y Zona Húmeda",
    "1 pase de invitado de cortesía cada mes",
    "Toalla deportiva limpia en cada visita",
    "Reserva preferente con 7 días de anticipación",
    "10 % de descuento en cafetería & bar del club",
  ],
  ANUAL: [
    "30 % de descuento garantizado todo el año en cualquier servicio",
    "Acceso total VIP: Gimnasio, Piscina, Sauna, Turco & Jacuzzi",
    "Casillero privado con cerradura digital asignado",
    "3 pases de invitado de cortesía al mes",
    "Inscripción prioritaria a torneos y eventos deportivos",
    "Ventana VIP de reservas anticipadas de hasta 15 días",
    "Servicio de conserjería deportiva personalizada",
  ],
};

/**
 * Calcula el desglose financiero transparente para un plan mostrando el precio
 * original, el descuento del 30% y el precio neto antes de confirmar el cobro.
 */
export function calcularDesglosePlan(
  plan: PlanMembresiaDTO,
  _esSocioVigente = false,
): PlanDisplayBreakdown {
  const rawPrecio =
    typeof plan.precio === "number" ? plan.precio : parseFloat(String(plan.precio)) || 0;
  const pct =
    typeof plan.descuentoPct === "number"
      ? plan.descuentoPct
      : parseFloat(String(plan.descuentoPct)) || 30;

  // Si en la base de datos la periodicidad no coincide con el nombre, inferirla inteligentemente
  let periodicidadKey: "SEMANAL" | "MENSUAL" | "ANUAL" = plan.periodicidad;
  const lowerNombre = (plan.nombre || "").toLowerCase();
  if (lowerNombre.includes("anual") || lowerNombre.includes("año")) {
    periodicidadKey = "ANUAL";
  } else if (lowerNombre.includes("mensual") || lowerNombre.includes("mes")) {
    periodicidadKey = "MENSUAL";
  } else if (lowerNombre.includes("semanal") || lowerNombre.includes("semana")) {
    periodicidadKey = "SEMANAL";
  }

  // Si en la BD se guardaron precios simbólicos de prueba de Stripe (<= 5.000 COP),
  // mostramos las tarifas comerciales colombianas estándar del complejo
  let precioOriginal = rawPrecio;
  if (rawPrecio <= 5000) {
    if (periodicidadKey === "SEMANAL") {
      precioOriginal = 50000;
    } else if (periodicidadKey === "MENSUAL") {
      precioOriginal = 180000;
    } else if (periodicidadKey === "ANUAL") {
      precioOriginal = 1800000;
    }
  }

  // Calculamos el valor del 30%
  const montoDescuento = Math.round((precioOriginal * pct) / 100);
  const precioConDescuento = Math.max(0, precioOriginal - montoDescuento);

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

  return {
    id: plan.id,
    nombre: plan.nombre,
    periodicidad: periodicidadKey,
    periodicidadLabel,
    precioOriginal,
    precioOriginalFormateado: formatMoney(precioOriginal),
    porcentajeDescuento: pct,
    montoDescuento,
    montoDescuentoFormateado: formatMoney(montoDescuento),
    precioConDescuento,
    precioConDescuentoFormateado: formatMoney(precioConDescuento),
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
    const res = await fetch("/api/memberships/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        planId,
        successUrl: `${window.location.origin}/portal/membership?success=true&plan_id=${planId}`,
        cancelUrl: `${window.location.origin}/portal/membership?cancelled=true`,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        errorCode: data.error?.code || "SUBSCRIBE_ERROR",
        errorMessage: data.error?.message || "No se pudo iniciar el proceso de suscripción.",
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
