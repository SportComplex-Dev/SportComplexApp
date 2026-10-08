import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export class ContingencyError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "ALREADY_INACTIVE",
    readonly status: number,
  ) {
    super(message);
    this.name = "ContingencyError";
  }
}

type ContingencyTransaction = Prisma.TransactionClient;

async function lockServiceAndAvailability(
  tx: ContingencyTransaction,
  serviceId: number,
): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM servicio
    WHERE id = ${serviceId}
    FOR UPDATE
  `;
  await tx.$queryRaw`
    SELECT id FROM disponibilidad
    WHERE servicio_id = ${serviceId}
    ORDER BY id
    FOR UPDATE
  `;
}

export async function disableServiceForContingency(input: {
  serviceId: number;
  adminId: string;
  reason: string;
}, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    await lockServiceAndAvailability(tx, input.serviceId);
    const service = await tx.servicio.findUnique({
      where: { id: input.serviceId },
      select: { id: true, nombre: true, estado: true },
    });
    if (!service) {
      throw new ContingencyError("Servicio no encontrado.", "NOT_FOUND", 404);
    }
    if (service.estado === "INHABILITADO") {
      throw new ContingencyError("El servicio ya está inhabilitado.", "ALREADY_INACTIVE", 409);
    }

    const availability = await tx.disponibilidad.findMany({
      where: { servicioId: input.serviceId },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const availabilityIds = availability.map(({ id }) => id);
    const inhabilitation = await tx.inhabilitacionServicio.create({
      data: {
        servicioId: input.serviceId,
        adminId: input.adminId,
        motivo: input.reason,
        fechaInicio: now,
      },
    });

    await tx.servicio.update({
      where: { id: input.serviceId },
      data: { estado: "INHABILITADO" },
    });

    const activeReservations = availabilityIds.length
      ? await tx.reserva.findMany({
          where: {
            disponibilidadId: { in: availabilityIds },
            estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA"] },
          },
          include: {
            titular: { select: { id: true, nombre: true, correo: true } },
            disponibilidad: {
              include: { franja: true },
            },
          },
          orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
        })
      : [];

    const reservationIds = activeReservations.map(({ id }) => id);
    if (reservationIds.length > 0) {
      await tx.reserva.updateMany({
        where: {
          id: { in: reservationIds },
          estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA"] },
        },
        data: {
          estado: "CANCELADA_ADMINISTRATIVA",
          inhabilitacionId: inhabilitation.id,
        },
      });
    }

    const occupiedByAvailability = new Map<bigint, number>();
    for (const reservation of activeReservations) {
      occupiedByAvailability.set(
        reservation.disponibilidadId,
        (occupiedByAvailability.get(reservation.disponibilidadId) ?? 0) +
          reservation.cantidadCupos,
      );
    }
    for (const [availabilityId, cupos] of occupiedByAvailability) {
      await tx.disponibilidad.update({
        where: { id: availabilityId },
        data: { cuposOcupados: { decrement: cupos } },
      });
    }

    const affectedReservations = activeReservations.map((reservation) => ({
      reservaId: reservation.id,
      usuarioId: reservation.titular.id,
      nombre: reservation.titular.nombre,
      correo: reservation.titular.correo,
      fecha: reservation.disponibilidad.fecha,
      horaInicio: reservation.disponibilidad.franja.horaInicio,
      horaFin: reservation.disponibilidad.franja.horaFin,
      cantidadCupos: reservation.cantidadCupos,
    }));

    return {
      inhabilitacion: inhabilitation,
      servicio: { id: service.id, nombre: service.nombre, estado: "INHABILITADO" as const },
      reservasCanceladas: affectedReservations,
      webhookPayload: {
        servicioId: service.id,
        servicio: service.nombre,
        motivo: input.reason,
        usuarios: affectedReservations,
      },
    };
  });
}

export async function markContingencyWebhookSent(id: number, sentAt = new Date()) {
  return prisma.inhabilitacionServicio.update({
    where: { id },
    data: { webhookEnviadoEn: sentAt },
  });
}
