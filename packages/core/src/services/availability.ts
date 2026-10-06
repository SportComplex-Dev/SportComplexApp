import { BOOKING_WINDOW_DAYS } from "../domain/index";

// RN-01 ventana 15 días + RN-11 prohibición de pasado. Todo en America/Bogota.
export function isWithinBookingWindow(now: Date, start: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  if (start.getTime() <= now.getTime()) return false; // RN-11
  const diffDays = (start.getTime() - now.getTime()) / msPerDay;
  return diffDays <= BOOKING_WINDOW_DAYS; // RN-01
}

export function checkoutExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + 15 * 60 * 1000); // RN-04 TTL 15 min
}

/** Configuración de horario y aforo para un servicio específico (RF-04 / HU-05) */
export interface OperatingScheduleConfig {
  serviceId: string;
  serviceName: string;
  categorySlug: string;
  capacity: number; // Aforo máximo (> 0, CHECK capacity > 0)
  isShared: boolean; // true para servicios compartidos con cupos por persona (ej. gimnasio, piscina), false para exclusivo (canchas)
  startHour: number; // Hora inicio en formato 24h (por defecto 6 -> 06:00)
  endHour: number; // Hora fin en formato 24h (por defecto 22 -> 22:00)
  slotDurationMinutes: number; // Duración fija de 60 minutos
  disabledSlots: string[]; // Ranuras deshabilitadas/mantenimiento (ej. ['13:00'])
}

/** Representación de una ranura horaria operativa generada */
export interface GeneratedOperatingSlot {
  time: string; // ej. "06:00"
  endTime: string; // ej. "07:00"
  label: string; // ej. "06:00 – 07:00"
  startHour: number;
  endHour: number;
  capacity: number;
  isShared: boolean;
  isAvailable: boolean;
  disabledReason?: string;
}

/**
 * Generador puro de ranuras horarias operativas entre 06:00 y 22:00 (RF-04).
 * Genera turnos continuos de 60 minutos.
 */
export function generateOperatingSlots(
  config: OperatingScheduleConfig
): GeneratedOperatingSlot[] {
  const slots: GeneratedOperatingSlot[] = [];
  const start = Math.max(0, Math.min(23, config.startHour));
  const end = Math.max(start + 1, Math.min(24, config.endHour));

  for (let hour = start; hour < end; hour++) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const timeStr = `${pad(hour)}:00`;
    const nextHourStr = `${pad(hour + 1)}:00`;
    const isDisabled = config.disabledSlots?.includes(timeStr) ?? false;

    slots.push({
      time: timeStr,
      endTime: nextHourStr,
      label: `${timeStr} – ${nextHourStr}`,
      startHour: hour,
      endHour: hour + 1,
      capacity: config.capacity,
      isShared: config.isShared,
      isAvailable: !isDisabled,
      disabledReason: isDisabled ? "Mantenimiento / Pausada por administración" : undefined,
    });
  }

  return slots;
}

/**
 * Validador de capacidad/aforo conforme a la restricción CHECK capacity > 0
 */
export function validateServiceCapacity(capacity: number): {
  valid: boolean;
  error?: string;
} {
  if (typeof capacity !== "number" || isNaN(capacity)) {
    return { valid: false, error: "La capacidad debe ser un número entero." };
  }
  if (!Number.isInteger(capacity)) {
    return { valid: false, error: "La capacidad debe ser un número entero." };
  }
  if (capacity <= 0) {
    return { valid: false, error: "La capacidad debe ser estrictamente mayor a 0 (CHECK capacity > 0)." };
  }
  return { valid: true };
}

