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
  horaInicio: Date;
  horaFin: Date;
}

export interface CrearTorneoInput {
  adminId: string;
  categoriaId: number;
  titulo: string;
  descripcion?: string | null;
  nivel: string;
  fechaInicio: Date;
  fechaFin: Date;
  cuposTotales: number;
  precioInscripcion?: number | string;
  bloqueos?: BloqueoCanchaInput[];
}

export interface ListarTorneosFiltros {
  estado?: EstadoTorneoValor;
  categoriaId?: number;
  soloActivos?: boolean;
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
 * Crea un torneo y registra sus bloqueos de pistas asociados.
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

  const precio = normalizePrecio(input.precioInscripcion);

  return db.torneo.create({
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
      estado: "BORRADOR",
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

  return db.torneo.update({
    where: { id },
    data: { estado: nuevoEstado },
  });
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
