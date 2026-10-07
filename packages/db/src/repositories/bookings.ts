import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

const BOOKING_WINDOW_DAYS = 15;
const HOLD_TTL_MINUTES = 15;
const BOGOTA_TIME_ZONE = "America/Bogota";

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
    throw new BookingError(
      "La fecha solicitada está fuera de la ventana de reserva de 15 días.",
      "OUTSIDE_BOOKING_WINDOW",
      400,
    );
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
