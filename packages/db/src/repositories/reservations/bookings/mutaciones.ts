import type { Prisma } from "@prisma/client";
import { prisma } from "../../../client";
import type { CartItemInput, CartBookingResult, BookingTransaction } from "./tipos";
import { BookingError, HOLD_TTL_MINUTES } from "./errores";
import {
  dateInBogota,
  secondsFromInstant,
  secondsFromDbTime,
  validateBookingDate,
  slotMatchesRequest,
} from "./mapeadores";

export const ESTADOS_OCUPAN_TITULAR = ["PENDIENTE_PAGO", "CONFIRMADA"] as const;

export async function lockAvailability(tx: BookingTransaction, availabilityId: bigint): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM disponibilidad
    WHERE id = ${availabilityId}
    FOR UPDATE
  `;
}

export async function releaseExpiredHolds(
  tx: BookingTransaction,
  availabilityId: bigint,
  now: Date,
): Promise<void> {
  const expired = await tx.reserva.findMany({
    where: {
      disponibilidadId: availabilityId,
      estado: "PENDIENTE_PAGO",
      expiraEn: { lte: now },
    },
    select: { id: true, cantidadCupos: true },
  });
  if (expired.length === 0) return;

  const expiredCupos = expired.reduce((total, hold) => total + hold.cantidadCupos, 0);
  await tx.reserva.updateMany({
    where: { id: { in: expired.map(({ id }) => id) } },
    data: { estado: "EXPIRADA" },
  });
  await tx.disponibilidad.update({
    where: { id: availabilityId },
    data: { cuposOcupados: { decrement: expiredCupos } },
  });
}

/**
 * TSK-BE-12 / RF-11 / RN-07 — regla de multirreserva concurrente.
 *
 * La unicidad de titular se aplica SOLO dentro de la misma instancia de
 * servicio: un usuario no puede tener dos reservas vivas que se solapen en el
 * tiempo para el mismo `servicioId` en la misma fecha. Entre categorías o
 * instancias distintas el solapamiento horario es válido (Cancha 1 + Piscina
 * 16:00-17:00 se confirman en paralelo).
 *
 * Un hold `PENDIENTE_PAGO` cuyo `expiraEn` ya venció deja de bloquear (el
 * job TSK-BD-08 o la limpieza perezosa lo liberarán); `EXPIRADA` y
 * `CANCELADA_ADMINISTRATIVA` nunca bloquean.
 *
 * @throws BookingError `TITULAR_RESERVATION_OVERLAP`(409).
 */
export async function assertNoTitularOverlap(
  tx: BookingTransaction,
  input: {
    titularId: string;
    servicioId: number;
    targetDate: Date;
    startTime: Date;
    endTime: Date;
    now: Date;
  },
): Promise<void> {
  const startSeconds = secondsFromInstant(input.startTime);
  const endSeconds = secondsFromInstant(input.endTime);

  const candidates = await tx.reserva.findMany({
    where: {
      titularId: input.titularId,
      estado: { in: [...ESTADOS_OCUPAN_TITULAR] },
      disponibilidad: {
        servicioId: input.servicioId,
        fecha: input.targetDate,
      },
    },
    select: {
      id: true,
      estado: true,
      expiraEn: true,
      disponibilidad: { select: { franja: { select: { horaInicio: true, horaFin: true } } } },
    },
  });

  const overlaps = candidates.some((reservation) => {
    if (
      reservation.estado === "PENDIENTE_PAGO" &&
      reservation.expiraEn &&
      reservation.expiraEn.getTime() <= input.now.getTime()
    ) {
      return false; // hold vencido: ya no bloquea al titular.
    }
    const franja = reservation.disponibilidad?.franja;
    if (!franja) return false;
    const otherStart = secondsFromDbTime(franja.horaInicio);
    const otherEnd = secondsFromDbTime(franja.horaFin);
    return otherStart < endSeconds && otherEnd > startSeconds;
  });

  if (overlaps) {
    throw new BookingError(
      "Ya tienes una reserva activa de este servicio en una franja que se solapa.",
      "TITULAR_RESERVATION_OVERLAP",
      409,
    );
  }
}

export async function createBookingHoldCart(input: {
  items: CartItemInput[];
  userId: string;
}, now = new Date()): Promise<CartBookingResult> {
  if (!Array.isArray(input.items) || input.items.length < 2) {
    throw new BookingError("El carrito debe contener al menos 2 servicios.", "INVALID_CART_SIZE", 400);
  }

  const validatedItems = input.items.map((item, index) => {
    if (!Number.isInteger(item.cantidadCupos) || item.cantidadCupos <= 0) {
      throw new BookingError(
        `Ítem ${index}: la cantidad de cupos debe ser un entero mayor que cero.`,
        "VALIDATION_ERROR",
        400,
      );
    }
    const startTime = new Date(item.startTime);
    const endTime = new Date(item.endTime);
    if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
      throw new BookingError(
        `Ítem ${index}: las fechas de la franja no son válidas.`,
        "VALIDATION_ERROR",
        400,
      );
    }
    if (startTime.getTime() <= now.getTime()) {
      throw new BookingError(
        `Ítem ${index}: la franja solicitada ya comenzó.`,
        "SLOT_IN_PAST",
        409,
      );
    }
    if (endTime <= startTime) {
      throw new BookingError(
        `Ítem ${index}: la hora de fin debe ser posterior al inicio.`,
        "VALIDATION_ERROR",
        400,
      );
    }
    const date = dateInBogota(startTime);
    validateBookingDate(date, now);
    return { ...item, startTime, endTime, date, index };
  });

  return prisma.$transaction(async (tx) => {
    const availabilityMap = new Map<string, {
      availability: {
        id: bigint;
        servicioId: number;
        servicio: { id: number; nombre: string; tarifa: Prisma.Decimal; modalidad: string; estado: string };
        franja: { id: number; horaInicio: Date; horaFin: Date };
        cuposTotales: number;
        cuposOcupados: number;
        bloqueadaMantenimiento: boolean;
      };
      item: typeof validatedItems[0];
    }>();

    const sortedItems = [...validatedItems].sort((a, b) => {
      if (a.serviceId !== b.serviceId) return a.serviceId - b.serviceId;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.getTime() - b.startTime.getTime();
    });

    for (const item of sortedItems) {
      const targetDate = new Date(`${item.date}T00:00:00.000Z`);
      const candidates = await tx.disponibilidad.findMany({
        where: {
          servicioId: item.serviceId,
          fecha: targetDate,
        },
        include: {
          servicio: true,
          franja: true,
        },
      });
      const candidate = candidates.find((av) => slotMatchesRequest(av, item.startTime, item.endTime));
      if (!candidate) {
        throw new BookingError(
          `Ítem ${item.index} (servicio ${item.serviceId}): la franja solicitada no existe.`,
          "SLOT_NOT_FOUND",
          404,
        );
      }

      await lockAvailability(tx, candidate.id);
      await releaseExpiredHolds(tx, candidate.id, now);

      const availability = await tx.disponibilidad.findUnique({
        where: { id: candidate.id },
        include: { servicio: true, franja: true },
      });
      if (!availability || availability.servicio.estado !== "ACTIVO") {
        throw new BookingError(
          `Ítem ${item.index} (servicio ${item.serviceId}): el servicio no está disponible.`,
          "SERVICE_UNAVAILABLE",
          409,
        );
      }
      if (availability.bloqueadaMantenimiento) {
        throw new BookingError(
          `Ítem ${item.index} (servicio ${item.serviceId}): la franja está bloqueada por mantenimiento.`,
          "SLOT_BLOCKED",
          409,
        );
      }
      if (availability.cuposOcupados + item.cantidadCupos > availability.cuposTotales) {
        throw new BookingError(
          `Ítem ${item.index} (servicio ${item.serviceId}): no hay suficientes cupos disponibles.`,
          "CAPACITY_EXCEEDED",
          409,
        );
      }
      if (availability.servicio.modalidad === "EXCLUSIVA" && item.cantidadCupos !== 1) {
        throw new BookingError(
          `Ítem ${item.index} (servicio ${item.serviceId}): las franjas exclusivas permiten una sola reserva.`,
          "INVALID_BOOKING_QUANTITY",
          400,
        );
      }

      const key = `${availability.servicioId}-${item.date}-${availability.franja.id}`;
      if (availabilityMap.has(key)) {
        throw new BookingError(
          `Ítem ${item.index}: servicio duplicado en la misma franja dentro del carrito.`,
          "DUPLICATE_SERVICE_IN_CART",
          409,
        );
      }
      availabilityMap.set(key, { availability, item });
    }

    for (const { availability, item } of availabilityMap.values()) {
      await assertNoTitularOverlap(tx, {
        titularId: input.userId,
        servicioId: availability.servicioId,
        targetDate: new Date(`${item.date}T00:00:00.000Z`),
        startTime: item.startTime,
        endTime: item.endTime,
        now,
      });
    }

    for (const { availability, item } of availabilityMap.values()) {
      const otherItems = [...availabilityMap.values()].filter(
        (v) => v.item.index !== item.index && v.availability.servicioId === availability.servicioId,
      );
      for (const other of otherItems) {
        const start1 = secondsFromInstant(item.startTime);
        const end1 = secondsFromInstant(item.endTime);
        const start2 = secondsFromInstant(other.item.startTime);
        const end2 = secondsFromInstant(other.item.endTime);
        if (start1 < end2 && end1 > start2) {
          throw new BookingError(
            `Ítem ${item.index} (servicio ${availability.servicioId}): solapamiento con otro servicio del mismo titular en el carrito.`,
            "TITULAR_RESERVATION_OVERLAP",
            409,
          );
        }
      }
    }

    const activeMembership = await tx.membresia.findFirst({
      where: {
        usuarioId: input.userId,
        estado: "VIGENTE",
      },
    });

    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
    const bookings = [];
    let total = 0;

    for (const { availability, item } of availabilityMap.values()) {
      await tx.disponibilidad.update({
        where: { id: availability.id },
        data: { cuposOcupados: { increment: item.cantidadCupos } },
      });

      const subtotal = Number(
        (Number(availability.servicio.tarifa) * item.cantidadCupos).toFixed(2),
      );

      let descuentoPct = 0;
      let itemTotal = subtotal;
      let membresiaId: number | null = null;

      if (activeMembership) {
        descuentoPct = 30.0;
        const rawDiscount = Number((subtotal * 0.3).toFixed(2));
        const discountAmount = Math.min(rawDiscount, subtotal);
        itemTotal = Number((subtotal - discountAmount).toFixed(2));
        membresiaId = activeMembership.id;
      }

      total += itemTotal;

      const booking = await tx.reserva.create({
        data: {
          disponibilidadId: availability.id,
          titularId: input.userId,
          membresiaId,
          cantidadCupos: item.cantidadCupos,
          canal: "ONLINE",
          estado: "PENDIENTE_PAGO",
          subtotal,
          descuentoPct,
          total: itemTotal,
          expiraEn: expiresAt,
        },
        include: {
          disponibilidad: {
            include: { servicio: true, franja: true },
          },
        },
      });
      bookings.push(booking);
    }

    return { bookings, total: Number(total.toFixed(2)), expiresAt };
  });
}

export async function createBookingHold(input: {
  serviceId: number;
  startTime: string;
  endTime: string;
  cantidadCupos: number;
  userId: string;
  canal?: "ONLINE" | "TAQUILLA";
  vendedorId?: string | null;
}, now = new Date()) {
  if (!Number.isInteger(input.cantidadCupos) || input.cantidadCupos <= 0) {
    throw new BookingError("La cantidad de cupos debe ser un entero mayor que cero.", "VALIDATION_ERROR", 400);
  }
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime())) {
    throw new BookingError("Las fechas de la franja no son válidas.", "VALIDATION_ERROR", 400);
  }

  const date = dateInBogota(startTime);
  validateBookingDate(date, now);
  if (startTime.getTime() <= now.getTime()) {
    throw new BookingError("La franja solicitada ya comenzó.", "SLOT_IN_PAST", 409);
  }
  if (endTime <= startTime) {
    throw new BookingError("La hora de fin debe ser posterior al inicio.", "VALIDATION_ERROR", 400);
  }

  return prisma.$transaction(async (tx) => {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    const candidates = await tx.disponibilidad.findMany({
      where: {
        servicioId: input.serviceId,
        fecha: targetDate,
      },
      include: {
        servicio: true,
        franja: true,
      },
    });
    const candidate = candidates.find((item) => slotMatchesRequest(item, startTime, endTime));
    if (!candidate) {
      throw new BookingError("La franja solicitada no existe.", "SLOT_NOT_FOUND", 404);
    }

    await lockAvailability(tx, candidate.id);
    await releaseExpiredHolds(tx, candidate.id, now);

    const availability = await tx.disponibilidad.findUnique({
      where: { id: candidate.id },
      include: { servicio: true, franja: true },
    });
    if (!availability || availability.servicio.estado !== "ACTIVO") {
      throw new BookingError("El servicio no está disponible.", "SERVICE_UNAVAILABLE", 409);
    }
    if (availability.bloqueadaMantenimiento) {
      throw new BookingError("La franja está bloqueada por mantenimiento.", "SLOT_BLOCKED", 409);
    }
    if (availability.cuposOcupados + input.cantidadCupos > availability.cuposTotales) {
      throw new BookingError("No hay suficientes cupos disponibles.", "CAPACITY_EXCEEDED", 409);
    }
    if (availability.servicio.modalidad === "EXCLUSIVA" && input.cantidadCupos !== 1) {
      throw new BookingError(
        "Las franjas exclusivas permiten una sola reserva.",
        "INVALID_BOOKING_QUANTITY",
        400,
      );
    }

    // TSK-BE-12 / RN-07: la unicidad de titular aplica solo dentro de la misma
    // instancia de servicio; entre servicios distintos el solapamiento es válido.
    await assertNoTitularOverlap(tx, {
      titularId: input.userId,
      servicioId: availability.servicioId,
      targetDate,
      startTime,
      endTime,
      now,
    });

    await tx.disponibilidad.update({
      where: { id: availability.id },
      data: { cuposOcupados: { increment: input.cantidadCupos } },
    });

    // RN-08: 30% descuento automático si el titular tiene membresía VIGENTE (portal y taquilla)
    const activeMembership = await tx.membresia.findFirst({
      where: {
        usuarioId: input.userId,
        estado: "VIGENTE",
      },
    });

    const subtotal = Number(
      (Number(availability.servicio.tarifa) * input.cantidadCupos).toFixed(2),
    );

    let descuentoPct = 0;
    let total = subtotal;
    let membresiaId: number | null = null;

    if (activeMembership) {
      descuentoPct = 30.0;
      const rawDiscount = Number((subtotal * 0.3).toFixed(2));
      const discountAmount = Math.min(rawDiscount, subtotal);
      total = Number((subtotal - discountAmount).toFixed(2));
      membresiaId = activeMembership.id;
    }

    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
    return tx.reserva.create({
      data: {
        disponibilidadId: availability.id,
        titularId: input.userId,
        vendedorId: input.vendedorId ?? null,
        membresiaId,
        cantidadCupos: input.cantidadCupos,
        canal: input.canal ?? "ONLINE",
        estado: "PENDIENTE_PAGO",
        subtotal,
        descuentoPct,
        total,
        expiraEn: expiresAt,
      },
      include: {
        disponibilidad: {
          include: { servicio: true, franja: true },
        },
      },
    });
  });
}
