import type { EstadoReserva, Prisma } from "@prisma/client";
import { prisma } from "../client";

const BOOKING_WINDOW_DAYS = 15;
const HOLD_TTL_MINUTES = 30;
const BOGOTA_TIME_ZONE = "America/Bogota";
// TSK-BE-06 — mensaje contractual RN-01 (duplicado de @sportcomplex/core: db no puede importar core).
const BOOKING_WINDOW_EXCEEDED_MESSAGE = "La reserva excede la ventana máxima permitida de 15 días";

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type BookingHistoryState =
  | "CONFIRMADA"
  | "EXPIRADA"
  | "CANCELADA_ADMINISTRATIVA";

interface BookingHistoryCursor {
  createdAt: Date;
  id: string;
}

function encodeHistoryCursor(booking: { creadoEn: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: booking.creadoEn.toISOString(), id: booking.id }),
  ).toString("base64url");
}

function decodeHistoryCursor(cursor: string): BookingHistoryCursor {
  try {
    if (cursor.length > 512) throw new Error("Cursor is too large");
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new Error("Cursor shape is invalid");
    }
    const createdAt = new Date(parsed.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || !/^[0-9a-f-]{36}$/i.test(parsed.id)) {
      throw new Error("Cursor values are invalid");
    }
    return { createdAt, id: parsed.id };
  } catch {
    throw new BookingError("El cursor de historial no es válido.", "INVALID_CURSOR", 400);
  }
}

export async function getBookingHistory(input: {
  userId: string;
  estado: BookingHistoryState;
  cursor?: string;
  limit?: number;
}) {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new BookingError("El límite debe estar entre 1 y 50.", "INVALID_LIMIT", 400);
  }
  const cursor = input.cursor ? decodeHistoryCursor(input.cursor) : undefined;
  const estado: EstadoReserva = input.estado;
  const where: Prisma.ReservaWhereInput = {
    titularId: input.userId,
    estado,
    ...(cursor
      ? {
          OR: [
            { creadoEn: { lt: cursor.createdAt } },
            { creadoEn: cursor.createdAt, id: { lt: cursor.id } },
          ],
        }
      : {}),
  };
  const rows = await prisma.reserva.findMany({
    where,
    orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      disponibilidad: {
        include: {
          servicio: true,
          franja: true,
        },
      },
      ticketQr: true,
    },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? encodeHistoryCursor(items[items.length - 1]) : null,
    hasMore,
  };
}

function dateInBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateFromDb(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function secondsFromDbTime(value: Date): number {
  return value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds();
}

function secondsFromInstant(value: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOGOTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
}

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function validateBookingDate(date: string, now: Date): void {
  const today = dateInBogota(now);
  const daysAhead = daysBetween(today, date);
  if (daysAhead < 0 || daysAhead > BOOKING_WINDOW_DAYS) {
    throw new BookingError(BOOKING_WINDOW_EXCEEDED_MESSAGE, "OUTSIDE_BOOKING_WINDOW", 400);
  }
}

type BookingTransaction = Prisma.TransactionClient;

async function lockAvailability(tx: BookingTransaction, availabilityId: bigint): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM disponibilidad
    WHERE id = ${availabilityId}
    FOR UPDATE
  `;
}

async function releaseExpiredHolds(
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

function slotMatchesRequest(
  availability: {
    fecha: Date;
    franja: { horaInicio: Date; horaFin: Date };
  },
  startTime: Date,
  endTime: Date,
): boolean {
  return (
    startTime.getUTCMilliseconds() === 0 &&
    endTime.getUTCMilliseconds() === 0 &&
    dateFromDb(availability.fecha) === dateInBogota(startTime) &&
    secondsFromDbTime(availability.franja.horaInicio) === secondsFromInstant(startTime) &&
    secondsFromDbTime(availability.franja.horaFin) === secondsFromInstant(endTime)
  );
}

/** Estados de `RESERVA` que ocupan la franja para el titular (RN-07). */
const ESTADOS_OCUPAN_TITULAR = ["PENDIENTE_PAGO", "CONFIRMADA"] as const;

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
async function assertNoTitularOverlap(
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

export async function getBookableAvailability(serviceId: number, date: string, now = new Date()) {
  validateBookingDate(date, now);
  const targetDate = new Date(`${date}T00:00:00.000Z`);

  return prisma.$transaction(async (tx) => {
    const availability = await tx.disponibilidad.findMany({
      where: {
        servicioId: serviceId,
        fecha: targetDate,
        servicio: { estado: "ACTIVO" },
      },
      include: {
        servicio: true,
        franja: true,
      },
      orderBy: { id: "asc" },
    });

    const result = [];
    for (const item of availability) {
      await lockAvailability(tx, item.id);
      await releaseExpiredHolds(tx, item.id, now);
      const refreshed = await tx.disponibilidad.findUnique({
        where: { id: item.id },
        include: { servicio: true, franja: true },
      });
      if (!refreshed) continue;

      const slotStart = new Date(
        `${date}T${refreshed.franja.horaInicio.toISOString().slice(11, 19)}-05:00`,
      );
      if (slotStart <= now) continue;
      result.push({
        id: refreshed.id,
        servicioId: refreshed.servicioId,
        fecha: refreshed.fecha,
        franja: refreshed.franja,
        modalidad: refreshed.servicio.modalidad,
        cuposTotales: refreshed.cuposTotales,
        cuposOcupados: refreshed.cuposOcupados,
        cuposDisponibles: refreshed.cuposTotales - refreshed.cuposOcupados,
        bloqueadaMantenimiento: refreshed.bloqueadaMantenimiento,
      });
    }
    return result;
  });
}

/**
 * Read-only availability for integrations that must not trigger lazy hold
 * expiration. Expired pending holds are accounted for in the returned capacity
 * without changing their reservation or availability rows.
 */
export async function getReadOnlyBookableAvailability(
  serviceId: number,
  date: string,
  now = new Date(),
) {
  validateBookingDate(date, now);
  const targetDate = new Date(`${date}T00:00:00.000Z`);
  const formatTime = (value: Date) => value.toISOString().slice(11, 19);
  const availability = await prisma.disponibilidad.findMany({
    where: {
      servicioId: serviceId,
      fecha: targetDate,
      servicio: { estado: "ACTIVO" },
    },
    include: {
      servicio: true,
      franja: true,
      reservas: {
        where: {
          estado: "PENDIENTE_PAGO",
          expiraEn: { lte: now },
        },
        select: { cantidadCupos: true },
      },
    },
    orderBy: { id: "asc" },
  });

  return availability
    .filter((item) => {
      const slotStart = new Date(
        `${date}T${item.franja.horaInicio.toISOString().slice(11, 19)}-05:00`,
      );
      return slotStart > now;
    })
    .map((item) => {
      const expiredHolds = item.reservas.reduce(
        (total, hold) => total + hold.cantidadCupos,
        0,
      );
      const cuposOcupados = Math.max(0, item.cuposOcupados - expiredHolds);
      return {
        id: item.id,
        servicioId: item.servicioId,
        servicioNombre: item.servicio.nombre,
        fecha: item.fecha,
        franja: {
          id: item.franja.id,
          diaSemana: item.franja.diaSemana,
          horaInicio: formatTime(item.franja.horaInicio),
          horaFin: formatTime(item.franja.horaFin),
        },
        modalidad: item.servicio.modalidad,
        cuposTotales: item.cuposTotales,
        cuposOcupados,
        cuposDisponibles: item.bloqueadaMantenimiento
          ? 0
          : Math.max(0, item.cuposTotales - cuposOcupados),
        bloqueadaMantenimiento: item.bloqueadaMantenimiento,
      };
    });
}

export async function createBookingHold(input: {
  serviceId: number;
  startTime: string;
  endTime: string;
  cantidadCupos: number;
  userId: string;
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

    const subtotal = Number(
      (Number(availability.servicio.tarifa) * input.cantidadCupos).toFixed(2),
    );
    const expiresAt = new Date(now.getTime() + HOLD_TTL_MINUTES * 60_000);
    return tx.reserva.create({
      data: {
        disponibilidadId: availability.id,
        titularId: input.userId,
        cantidadCupos: input.cantidadCupos,
        canal: "ONLINE",
        estado: "PENDIENTE_PAGO",
        subtotal,
        descuentoPct: 0,
        total: subtotal,
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
