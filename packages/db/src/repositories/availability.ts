import { Prisma } from "@prisma/client";
import type { CanalReserva, Reserva } from "@prisma/client";
import { prisma } from "../client";

/**
 * TSK-BD-07 — Repositorio transaccional de disponibilidad con bloqueo de fila.
 *
 * Garantía: Overbooking = 0.
 * Único camino que modifica `cupos_ocupados`: toda ocupación de cupos DEBE
 * pasar por `reserveDisponibilidad` (único que ejecuta `SELECT ... FOR UPDATE`
 * antes de tocar el contador). Otros writes (aprovisionamiento `upsert` con
 * `update: {}` y limpieza admin con guarda `reservas: none`) viven en
 * `services.ts` y nunca tocan el contador. Ver auditoría en README.
 *
 * Flujo atómico (una sola transacción):
 *  1. `SELECT ... FOR UPDATE` sobre `disponibilidad.id`
 *  2. Verificar `bloqueada_mantenimiento = false`
 *  3. Verificar `fecha BETWEEN hoy AND hoy+15` en `America/Bogota`
 *  4. Verificar `cupos_ocupados + cantidad <= cupos_totales`
 *  5. `UPDATE cupos_ocupados += cantidad` condicional (defensa en profundidad)
 *  6. `INSERT reserva` en `PENDIENTE_PAGO` con `expira_en = now + 15 min`
 *
 * Concurrencia: N transacciones sobre la misma fila se serializan por el
 * row-lock; exactamente 1 gana y el resto recibe `SlotNoCapacityError` (HTTP 409).
 */

// TSK-BE-06 — mensaje contractual RN-01 (duplicado de @sportcomplex/core: db no puede importar core).
const BOOKING_WINDOW_EXCEEDED_MESSAGE = "La reserva excede la ventana máxima permitida de 15 días";

export const BOOKING_WINDOW_DAYS = 15 as const;
export const CHECKOUT_TTL_MINUTES = 15 as const;
export const BOOKING_TIMEZONE = "America/Bogota" as const;

/** Patrón auditado: ningún write sobre disponibilidad puede omitirlo. */
export const FOR_UPDATE_SQL_MARKER = "FOR UPDATE" as const;

export type AvailabilityErrorCode =
  | "SLOT_NOT_FOUND"
  | "SLOT_BLOCKED"
  | "SLOT_OUT_OF_WINDOW"
  | "SLOT_NO_CAPACITY"
  | "INVALID_QUANTITY";

export class AvailabilityError extends Error {
  readonly code: AvailabilityErrorCode;
  /** Mapeo HTTP sugerido para la capa API. */
  readonly httpStatus: number;

  constructor(code: AvailabilityErrorCode, message: string) {
    super(message);
    this.name = "AvailabilityError";
    this.code = code;
    this.httpStatus =
      code === "SLOT_NOT_FOUND"
        ? 404
        : code === "SLOT_OUT_OF_WINDOW"
          ? 400 // TSK-BE-06: petición manipulada debe recibir HTTP 400.
          : code === "INVALID_QUANTITY"
            ? 400
            : 409; // SLOT_BLOCKED, SLOT_NO_CAPACITY -> 409
  }
}

export interface ReserveDisponibilidadInput {
  disponibilidadId: bigint | number | string;
  titularId: string;
  cantidadCupos?: number;
  canal?: CanalReserva;
  vendedorId?: string | null;
  membresiaId?: number | null;
  subtotal: number | string | Prisma.Decimal;
  descuentoPct?: number | string | Prisma.Decimal;
  total: number | string | Prisma.Decimal;
  /** Inyectable para tests; por defecto `new Date()`. */
  now?: Date;
}

type DisponibilidadRow = {
  id: bigint;
  servicio_id: number;
  franja_id: number;
  fecha: Date | string;
  cupos_totales: number;
  cupos_ocupados: number;
  bloqueada_mantenimiento: boolean;
};

const bogotaDateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` de un instante en hora legal `America/Bogota`. */
export function toBogotaDateString(date: Date): string {
  return bogotaDateFmt.format(date);
}

/** Suma días calendario operando sobre el string Bogota (offset fijo UTC-5, sin DST). */
export function addDaysToBogotaDateString(dateStr: string, days: number): string {
  const anchor = new Date(`${dateStr}T12:00:00-05:00`);
  const shifted = new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  return bogotaDateFmt.format(shifted);
}

/** Ventana reservable inclusiva `[hoy, hoy+15]` en Bogota. */
export function getBookingWindow(now: Date = new Date()): { min: string; max: string } {
  const min = toBogotaDateString(now);
  return { min, max: addDaysToBogotaDateString(min, BOOKING_WINDOW_DAYS) };
}

/** Normaliza `DATE` de Postgres/Prisma a `YYYY-MM-DD` en Bogota. */
export function toFechaString(fecha: Date | string): string {
  if (typeof fecha === "string") return fecha.slice(0, 10);
  return toBogotaDateString(fecha);
}

export function isFechaWithinWindow(fecha: Date | string, now: Date = new Date()): boolean {
  const f = toFechaString(fecha);
  const { min, max } = getBookingWindow(now);
  return f >= min && f <= max;
}

function toBigintId(id: bigint | number | string): bigint {
  try {
    return typeof id === "bigint" ? id : BigInt(id);
  } catch {
    throw new AvailabilityError("SLOT_NOT_FOUND", `Disponibilidad no encontrada: ${String(id)}`);
  }
}

/**
 * Reserva atómica de cupos. Serializa competidores con row-lock.
 *
 * @throws AvailabilityError `SLOT_NOT_FOUND`(404) | `SLOT_BLOCKED`(409)
 * | `SLOT_OUT_OF_WINDOW`(400) | `SLOT_NO_CAPACITY`(409) | `INVALID_QUANTITY`(400)
 */
export async function reserveDisponibilidad(input: ReserveDisponibilidadInput): Promise<Reserva> {
  const cantidad = input.cantidadCupos ?? 1;
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new AvailabilityError("INVALID_QUANTITY", `cantidadCupos debe ser entero >= 1 (recibido ${String(input.cantidadCupos)})`);
  }
  const disponibilidadId = toBigintId(input.disponibilidadId);
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    // 1. Bloqueo de fila — ÚNICO punto de lectura previo a escribir cupos.
    // AUDIT: no agregar otro SELECT/UPDATE de disponibilidad sin FOR UPDATE.
    const rows = await tx.$queryRaw<DisponibilidadRow[]>`
      SELECT id, servicio_id, franja_id, fecha, cupos_totales, cupos_ocupados, bloqueada_mantenimiento
      FROM "disponibilidad"
      WHERE id = ${disponibilidadId}
      FOR UPDATE
    `;
    const slot = rows[0];
    if (!slot) {
      throw new AvailabilityError("SLOT_NOT_FOUND", `Disponibilidad ${String(input.disponibilidadId)} no encontrada`);
    }

    // 2. Mantenimiento.
    if (slot.bloqueada_mantenimiento) {
      throw new AvailabilityError("SLOT_BLOCKED", "Franja bloqueada por mantenimiento");
    }

    // 3. Ventana 15 días en America/Bogota (RN-01 + RN-11: sin pasado).
    const fechaStr = toFechaString(slot.fecha);
    const { min, max } = getBookingWindow(now);
    if (fechaStr < min || fechaStr > max) {
      throw new AvailabilityError("SLOT_OUT_OF_WINDOW", BOOKING_WINDOW_EXCEEDED_MESSAGE);
    }

    // 4. Aforo bajo lock.
    if (slot.cupos_ocupados + cantidad > slot.cupos_totales) {
      throw new AvailabilityError(
        "SLOT_NO_CAPACITY",
        `Sin cupo: ocupados ${slot.cupos_ocupados}/${slot.cupos_totales}, solicitados ${cantidad}`,
      );
    }

    // 5. Incremento condicional (segunda barrera anti-overbooking si el lock se bypaseara).
    const updated = await tx.$executeRaw`
      UPDATE "disponibilidad"
      SET "cupos_ocupados" = "cupos_ocupados" + ${cantidad}
      WHERE id = ${disponibilidadId}
        AND "cupos_ocupados" + ${cantidad} <= "cupos_totales"
    `;
    if (Number(updated) !== 1) {
      throw new AvailabilityError("SLOT_NO_CAPACITY", "Sin cupo (condición de carrera detectada)");
    }

    // 6. Reserva en PENDIENTE_PAGO con TTL 15 min (RN-04).
    return tx.reserva.create({
      data: {
        disponibilidadId,
        titularId: input.titularId,
        vendedorId: input.vendedorId ?? null,
        membresiaId: input.membresiaId ?? null,
        cantidadCupos: cantidad,
        canal: input.canal ?? "ONLINE",
        estado: "PENDIENTE_PAGO",
        subtotal: input.subtotal,
        descuentoPct: input.descuentoPct ?? 0,
        total: input.total,
        expiraEn: new Date(now.getTime() + CHECKOUT_TTL_MINUTES * 60 * 1000),
      },
    });
  });
}

/** Type-guard para mapear a HTTP en la capa API (`err.httpStatus`: 400/404/409). */
export function isAvailabilityError(err: unknown): err is AvailabilityError {
  return err instanceof AvailabilityError;
}
