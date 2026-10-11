/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../client";

export type EstadoTorneoValor =
  | "BORRADOR"
  | "INSCRIPCIONES_ABIERTAS"
  | "EN_CURSO"
  | "FINALIZADO"
  | "CANCELADO";

export type EstadoInscripcionTorneoValor =
  | "PENDIENTE_PAGO"
  | "CONFIRMADA"
  | "CANCELADA";

export class TournamentError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TournamentError";
  }
}

export interface BloqueoCanchaInput {
  servicioId: number;
  horaInicio: Date | string;
  horaFin: Date | string;
}

export interface CrearTorneoInput {
  adminId: string;
  categoriaId: number;
  titulo: string;
  descripcion?: string | null;
  nivel: string;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  cuposTotales: number;
  precioInscripcion?: number | string;
  estado?: EstadoTorneoValor;
  bloqueos?: BloqueoCanchaInput[];
}

export interface ActualizarTorneoInput {
  titulo?: string;
  descripcion?: string | null;
  categoriaId?: number;
  nivel?: string;
  fechaInicio?: Date | string;
  fechaFin?: Date | string;
  cuposTotales?: number;
  precioInscripcion?: number | string;
  estado?: EstadoTorneoValor;
  bloqueos?: BloqueoCanchaInput[];
}

export interface ListarTorneosFiltros {
  estado?: EstadoTorneoValor;
  categoriaId?: number;
  soloActivos?: boolean;
  search?: string;
}

export interface InscribirUsuarioInput {
  torneoId: string;
  usuarioId: string;
  nombrePareja?: string | null;
  pagoId?: string | null;
  confirmado?: boolean;
}

export interface TournamentDbOptions {
  db?: any;
}

function normalizePrecio(val: number | string | undefined): number {
  if (val === undefined || val === null) return 0;
  const num = typeof val === "number" ? val : parseFloat(val);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

/**
 * Verifica si hay reservas activas (CONFIRMADA o PENDIENTE_PAGO vigente)
 * en el servicio y rango horario especificado.
 */
export async function verificarConflictoReservas(
  servicioId: number,
  horaInicio: Date,
  horaFin: Date,
  options: TournamentDbOptions = {},
): Promise<boolean> {
  const db = options.db ?? prisma;
  const now = new Date();

  const targetDateStr = new Date(horaInicio).toISOString().slice(0, 10);
  const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);

  const disponibilidades = await db.disponibilidad.findMany({
    where: {
      servicioId,
      fecha: targetDate,
    },
    include: {
      franja: true,
      reservas: {
        where: {
          estado: { in: ["CONFIRMADA", "PENDIENTE_PAGO"] },
        },
        select: { id: true, estado: true, expiraEn: true },
      },
    },
  });

  const startSec =
    new Date(horaInicio).getUTCHours() * 3600 +
    new Date(horaInicio).getUTCMinutes() * 60;
  const endSec =
    new Date(horaFin).getUTCHours() * 3600 +
    new Date(horaFin).getUTCMinutes() * 60;

  for (const disp of disponibilidades) {
    if (!disp.franja) continue;
    const fStart =
      new Date(disp.franja.horaInicio).getUTCHours() * 3600 +
      new Date(disp.franja.horaInicio).getUTCMinutes() * 60;
    const fEnd =
      new Date(disp.franja.horaFin).getUTCHours() * 3600 +
      new Date(disp.franja.horaFin).getUTCMinutes() * 60;

    // Verificar si se solapan en franja horaria
    const solapa = fStart < endSec && fEnd > startSec;
    if (solapa && Array.isArray(disp.reservas)) {
      const activas = disp.reservas.filter((r: any) => {
        if (r.estado === "CONFIRMADA") return true;
        if (r.estado === "PENDIENTE_PAGO" && r.expiraEn && new Date(r.expiraEn) > now) {
          return true;
        }
        return false;
      });
      if (activas.length > 0) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Bloquea franjas en Disponibilidad para un conjunto de bloqueos.
 */
export async function aplicarBloqueosDisponibilidad(
  bloqueos: BloqueoCanchaInput[],
  options: TournamentDbOptions = {},
): Promise<void> {
  const db = options.db ?? prisma;

  for (const b of bloqueos) {
    const targetDateStr = new Date(b.horaInicio).toISOString().slice(0, 10);
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    const startSec =
      new Date(b.horaInicio).getUTCHours() * 3600 +
      new Date(b.horaInicio).getUTCMinutes() * 60;
    const endSec =
      new Date(b.horaFin).getUTCHours() * 3600 +
      new Date(b.horaFin).getUTCMinutes() * 60;

    const disponibilidades = await db.disponibilidad.findMany({
      where: {
        servicioId: b.servicioId,
        fecha: targetDate,
      },
      include: { franja: true },
    });

    for (const disp of disponibilidades) {
      if (!disp.franja) continue;
      const fStart =
        new Date(disp.franja.horaInicio).getUTCHours() * 3600 +
        new Date(disp.franja.horaInicio).getUTCMinutes() * 60;
      const fEnd =
        new Date(disp.franja.horaFin).getUTCHours() * 3600 +
        new Date(disp.franja.horaFin).getUTCMinutes() * 60;

      if (fStart < endSec && fEnd > startSec) {
        await db.disponibilidad.update({
          where: { id: disp.id },
          data: { bloqueadaMantenimiento: true },
        });
      }
    }
  }
}

/**
 * Libera las franjas bloqueadas en Disponibilidad para un torneo cancelado o eliminado.
 */
export async function liberarBloqueosTorneo(
  torneoId: string,
  options: TournamentDbOptions = {},
): Promise<void> {
  const db = options.db ?? prisma;
  const bloqueos = await db.torneoBloqueo.findMany({
    where: { torneoId },
  });

  for (const b of bloqueos) {
    const targetDateStr = new Date(b.horaInicio).toISOString().slice(0, 10);
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    const startSec =
      new Date(b.horaInicio).getUTCHours() * 3600 +
      new Date(b.horaInicio).getUTCMinutes() * 60;
    const endSec =
      new Date(b.horaFin).getUTCHours() * 3600 +
      new Date(b.horaFin).getUTCMinutes() * 60;

    const disponibilidades = await db.disponibilidad.findMany({
      where: {
        servicioId: b.servicioId,
        fecha: targetDate,
      },
      include: { franja: true },
    });

    for (const disp of disponibilidades) {
      if (!disp.franja) continue;
      const fStart =
        new Date(disp.franja.horaInicio).getUTCHours() * 3600 +
        new Date(disp.franja.horaInicio).getUTCMinutes() * 60;
      const fEnd =
        new Date(disp.franja.horaFin).getUTCHours() * 3600 +
        new Date(disp.franja.horaFin).getUTCMinutes() * 60;

      if (fStart < endSec && fEnd > startSec) {
        await db.disponibilidad.update({
          where: { id: disp.id },
          data: { bloqueadaMantenimiento: false },
        });
      }
    }
  }
}

/**
 * Crea un torneo y registra sus bloqueos de pistas asociados validando disponibilidad.
 */
export async function crearTorneo(
  input: CrearTorneoInput,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  if (!input.titulo?.trim()) {
    throw new TournamentError("El título del torneo es obligatorio.", "VALIDATION_ERROR", 400);
  }
  if (input.cuposTotales <= 0) {
    throw new TournamentError("Los cupos totales deben ser mayores a cero.", "VALIDATION_ERROR", 400);
  }
  if (new Date(input.fechaFin) <= new Date(input.fechaInicio)) {
    throw new TournamentError("La fecha de finalización debe ser posterior a la de inicio.", "VALIDATION_ERROR", 400);
  }

  // Validar solapamiento preventivo con reservas existentes
  if (input.bloqueos && input.bloqueos.length > 0) {
    for (const b of input.bloqueos) {
      const hayConflicto = await verificarConflictoReservas(
        b.servicioId,
        new Date(b.horaInicio),
        new Date(b.horaFin),
        options,
      );
      if (hayConflicto) {
        throw new TournamentError(
          `La pista ${b.servicioId} ya cuenta con reservas confirmadas o en proceso en el horario solicitado.`,
          "COURT_SLOT_CONFLICT",
          409,
        );
      }
    }
  }

  const precio = normalizePrecio(input.precioInscripcion);

  const torneo = await db.torneo.create({
    data: {
      adminId: input.adminId,
      categoriaId: input.categoriaId,
      titulo: input.titulo.trim(),
      descripcion: input.descripcion?.trim() ?? null,
      nivel: input.nivel.trim(),
      fechaInicio: new Date(input.fechaInicio),
      fechaFin: new Date(input.fechaFin),
      cuposTotales: input.cuposTotales,
      cuposOcupados: 0,
      precioInscripcion: precio,
      estado: input.estado ?? "BORRADOR",
      ...(input.bloqueos && input.bloqueos.length > 0
        ? {
            bloqueos: {
              create: input.bloqueos.map((b) => ({
                servicioId: b.servicioId,
                horaInicio: new Date(b.horaInicio),
                horaFin: new Date(b.horaFin),
              })),
            },
          }
        : {}),
    },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
    },
  });

  // Aplicar bloqueo en disponibilidad de franjas
  if (input.bloqueos && input.bloqueos.length > 0) {
    await aplicarBloqueosDisponibilidad(input.bloqueos, options);
  }

  return torneo;
}

/**
 * Lista torneos con filtros opcionales.
 */
export async function listarTorneos(
  filtros: ListarTorneosFiltros = {},
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const where: any = {};

  if (filtros.estado) {
    where.estado = filtros.estado;
  } else if (filtros.soloActivos) {
    where.estado = { in: ["INSCRIPCIONES_ABIERTAS", "EN_CURSO"] };
  }

  if (filtros.categoriaId) {
    where.categoriaId = filtros.categoriaId;
  }

  if (filtros.search) {
    where.titulo = { contains: filtros.search, mode: "insensitive" };
  }

  return db.torneo.findMany({
    where,
    orderBy: { fechaInicio: "asc" },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
      _count: { select: { inscripciones: true } },
    },
  });
}

/**
 * Obtiene el detalle de un torneo por su ID.
 */
export async function obtenerTorneoPorId(
  id: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
      inscripciones: {
        include: { usuario: { select: { id: true, nombre: true, correo: true } } },
      },
    },
  });

  if (!torneo) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  return torneo;
}

/**
 * Actualiza el estado de un torneo.
 */
export async function actualizarEstadoTorneo(
  id: string,
  nuevoEstado: EstadoTorneoValor,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const torneo = await db.torneo.findUnique({ where: { id } });
  if (!torneo) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  if (nuevoEstado === "CANCELADO") {
    await liberarBloqueosTorneo(id, options);
  }

  return db.torneo.update({
    where: { id },
    data: { estado: nuevoEstado },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
    },
  });
}

/**
 * Actualiza los campos de un torneo y actualiza sus bloqueos de pista.
 */
export async function actualizarTorneo(
  id: string,
  input: ActualizarTorneoInput,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: { bloqueos: true },
  });
  if (!torneo) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  const updateData: any = {};
  if (input.titulo !== undefined) {
    if (!input.titulo.trim()) {
      throw new TournamentError("El título del torneo no puede estar vacío.", "VALIDATION_ERROR", 400);
    }
    updateData.titulo = input.titulo.trim();
  }
  if (input.descripcion !== undefined) {
    updateData.descripcion = input.descripcion?.trim() ?? null;
  }
  if (input.categoriaId !== undefined) {
    updateData.categoriaId = input.categoriaId;
  }
  if (input.nivel !== undefined) {
    updateData.nivel = input.nivel.trim();
  }
  if (input.fechaInicio !== undefined) {
    updateData.fechaInicio = new Date(input.fechaInicio);
  }
  if (input.fechaFin !== undefined) {
    updateData.fechaFin = new Date(input.fechaFin);
  }

  const fIni = updateData.fechaInicio ?? torneo.fechaInicio;
  const fFin = updateData.fechaFin ?? torneo.fechaFin;
  if (new Date(fFin) <= new Date(fIni)) {
    throw new TournamentError("La fecha de finalización debe ser posterior a la de inicio.", "VALIDATION_ERROR", 400);
  }

  if (input.cuposTotales !== undefined) {
    if (input.cuposTotales <= 0 || input.cuposTotales < (torneo.cuposOcupados ?? 0)) {
      throw new TournamentError(
        "Los cupos totales no pueden ser menores a los cupos ya ocupados.",
        "VALIDATION_ERROR",
        400,
      );
    }
    updateData.cuposTotales = input.cuposTotales;
  }
  if (input.precioInscripcion !== undefined) {
    updateData.precioInscripcion = normalizePrecio(input.precioInscripcion);
  }
  if (input.estado !== undefined) {
    updateData.estado = input.estado;
    if (input.estado === "CANCELADO") {
      await liberarBloqueosTorneo(id, options);
    }
  }

  if (input.bloqueos !== undefined) {
    for (const b of input.bloqueos) {
      const hayConflicto = await verificarConflictoReservas(
        b.servicioId,
        new Date(b.horaInicio),
        new Date(b.horaFin),
        options,
      );
      if (hayConflicto) {
        throw new TournamentError(
          `La pista ${b.servicioId} ya cuenta con reservas confirmadas o en proceso en el horario solicitado.`,
          "COURT_SLOT_CONFLICT",
          409,
        );
      }
    }

    // Liberar bloqueos previos
    await liberarBloqueosTorneo(id, options);
    if (db.torneoBloqueo?.deleteMany) {
      await db.torneoBloqueo.deleteMany({ where: { torneoId: id } });
    }

    // Registrar nuevos bloqueos
    if (input.bloqueos.length > 0 && db.torneoBloqueo?.createMany) {
      await db.torneoBloqueo.createMany({
        data: input.bloqueos.map((b) => ({
          torneoId: id,
          servicioId: b.servicioId,
          horaInicio: new Date(b.horaInicio),
          horaFin: new Date(b.horaFin),
        })),
      });
      await aplicarBloqueosDisponibilidad(input.bloqueos, options);
    }
  }

  return db.torneo.update({
    where: { id },
    data: updateData,
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
    },
  });
}

/**
 * Elimina o cancela un torneo de forma controlada:
 * - Si tiene inscripciones registradas o no está en BORRADOR, lo cancela y libera bloqueos.
 * - Si está en BORRADOR sin inscripciones, lo elimina físicamente y libera bloqueos.
 */
export async function eliminarTorneo(
  id: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      bloqueos: true,
      inscripciones: true,
    },
  });

  if (!torneo) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  await liberarBloqueosTorneo(id, options);

  const tieneInscripciones =
    Array.isArray(torneo.inscripciones) && torneo.inscripciones.length > 0;

  if (tieneInscripciones || torneo.estado !== "BORRADOR") {
    return db.torneo.update({
      where: { id },
      data: { estado: "CANCELADO" },
      include: {
        categoria: true,
        bloqueos: { include: { servicio: true } },
      },
    });
  }

  if (db.torneoBloqueo?.deleteMany) {
    await db.torneoBloqueo.deleteMany({ where: { torneoId: id } });
  }

  return db.torneo.delete({ where: { id } });
}

/**
 * Inscribe a un usuario a un torneo de forma atómica y valida cupos.
 */
export async function inscribirUsuarioTorneo(
  input: InscribirUsuarioInput,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  return db.$transaction(async (tx: any) => {
    const torneo = await tx.torneo.findUnique({ where: { id: input.torneoId } });
    if (!torneo) {
      throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
    }

    if (torneo.estado !== "INSCRIPCIONES_ABIERTAS") {
      throw new TournamentError(
        `Las inscripciones no están abiertas para este torneo (estado: ${torneo.estado}).`,
        "REGISTRATION_CLOSED",
        400,
      );
    }

    if (torneo.cuposOcupados >= torneo.cuposTotales) {
      throw new TournamentError(
        "No hay cupos disponibles para este torneo.",
        "CAPACITY_EXCEEDED",
        409,
      );
    }

    const inscripcionExistente = await tx.inscripcionTorneo.findUnique({
      where: {
        torneoId_usuarioId: {
          torneoId: input.torneoId,
          usuarioId: input.usuarioId,
        },
      },
    });

    if (inscripcionExistente) {
      if (inscripcionExistente.estado === "CONFIRMADA") {
        throw new TournamentError(
          "El usuario ya se encuentra inscrito en este torneo.",
          "ALREADY_REGISTERED",
          409,
        );
      }
    }

    const estadoInicial: EstadoInscripcionTorneoValor = input.confirmado
      ? "CONFIRMADA"
      : Number(torneo.precioInscripcion) === 0
        ? "CONFIRMADA"
        : "PENDIENTE_PAGO";

    const inscripcion = await tx.inscripcionTorneo.create({
      data: {
        torneoId: input.torneoId,
        usuarioId: input.usuarioId,
        nombrePareja: input.nombrePareja?.trim() ?? null,
        pagoId: input.pagoId ?? null,
        estado: estadoInicial,
        ticketEstado: "EMITIDO",
      },
      include: {
        torneo: true,
        usuario: { select: { id: true, nombre: true, correo: true } },
      },
    });

    if (estadoInicial === "CONFIRMADA") {
      await tx.torneo.update({
        where: { id: input.torneoId },
        data: { cuposOcupados: { increment: 1 } },
      });
    }

    return inscripcion;
  });
}

/**
 * Obtiene los datos de una inscripción para verificación de acceso vía código QR.
 */
export async function obtenerInscripcionPorTicket(
  ticketCodigoUuid: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const inscripcion = await db.inscripcionTorneo.findUnique({
    where: { ticketCodigoUuid },
    include: {
      torneo: { include: { categoria: true } },
      usuario: { select: { id: true, nombre: true, correo: true } },
    },
  });

  if (!inscripcion) {
    throw new TournamentError("Ticket de torneo no encontrado.", "TICKET_NOT_FOUND", 404);
  }

  return inscripcion;
}

/**
 * Canjea el ticket de acceso al torneo en puerta de forma irreversible.
 */
export async function canjearTicketTorneo(
  ticketCodigoUuid: string,
  empleadoId: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  return db.$transaction(async (tx: any) => {
    const inscripcion = await tx.inscripcionTorneo.findUnique({
      where: { ticketCodigoUuid },
      include: { torneo: true },
    });

    if (!inscripcion) {
      throw new TournamentError("Ticket de torneo no encontrado.", "TICKET_NOT_FOUND", 404);
    }

    if (inscripcion.estado !== "CONFIRMADA") {
      throw new TournamentError("La inscripción no está confirmada.", "INSCRIPTION_NOT_CONFIRMED", 400);
    }

    if (inscripcion.ticketEstado === "USADO") {
      throw new TournamentError("El ticket de torneo ya fue utilizado.", "ALREADY_USED", 409);
    }

    return tx.inscripcionTorneo.update({
      where: { id: inscripcion.id },
      data: {
        ticketEstado: "USADO",
        ticketUsadoEn: new Date(),
        ticketUsadoPor: empleadoId,
      },
      include: {
        torneo: true,
        usuario: { select: { id: true, nombre: true } },
      },
    });
  });
}
