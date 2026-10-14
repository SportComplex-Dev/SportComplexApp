import type { EstadoReserva, Prisma } from "@prisma/client";
import { prisma } from "../../client";
import type { BookingHistoryState } from "./tipos";
import { BookingError } from "./errores";
import {
  decodeHistoryCursor,
  encodeHistoryCursor,
  validateBookingDate,
} from "./mapeadores";
import { lockAvailability, releaseExpiredHolds } from "./mutaciones";

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
