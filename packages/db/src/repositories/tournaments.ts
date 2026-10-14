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
  page?: number;
  limit?: number;
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

export const BOGOTA_TIME_ZONE = "America/Bogota";

export function dateInBogota(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function secondsFromDbTime(value: Date): number {
  return value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds();
}

export function secondsFromInstant(value: Date | string): number {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOGOTA_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
}

function normalizePrecio(val: number | string | undefined): number {
  if (val === undefined || val === null) return 0;
  const num = typeof val === "number" ? val : parseFloat(val);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

/**
 * Verifica si hay reservas activas (CONFIRMADA o PENDIENTE_PAGO vigente)
 * en el servicio y rango horario especificado (ajustado a America/Bogota).
 */
export async function verificarConflictoReservas(
  servicioId: number,
  horaInicio: Date | string,
  horaFin: Date | string,
  options: TournamentDbOptions = {},
): Promise<boolean> {
  const db = options.db ?? prisma;
  const now = new Date();

  const targetDateStr = dateInBogota(horaInicio);
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

  const startSec = secondsFromInstant(horaInicio);
  const endSec = secondsFromInstant(horaFin);

  for (const disp of disponibilidades) {
    if (!disp.franja) continue;
    const fStart = secondsFromDbTime(new Date(disp.franja.horaInicio));
    const fEnd = secondsFromDbTime(new Date(disp.franja.horaFin));

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
 * Bloquea franjas en Disponibilidad para un conjunto de bloqueos (optimizado por lote).
 */
export async function aplicarBloqueosDisponibilidad(
  bloqueos: BloqueoCanchaInput[],
  options: TournamentDbOptions = {},
): Promise<void> {
  const db = options.db ?? prisma;

  for (const b of bloqueos) {
    const targetDateStr = dateInBogota(b.horaInicio);
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    const startSec = secondsFromInstant(b.horaInicio);
    const endSec = secondsFromInstant(b.horaFin);

    const disponibilidades = await db.disponibilidad.findMany({
      where: {
        servicioId: b.servicioId,
        fecha: targetDate,
      },
      include: { franja: true },
    });

    const matchingIds: bigint[] = [];
    for (const disp of disponibilidades) {
      if (!disp.franja) continue;
      const fStart = secondsFromDbTime(new Date(disp.franja.horaInicio));
      const fEnd = secondsFromDbTime(new Date(disp.franja.horaFin));

      if (fStart < endSec && fEnd > startSec) {
        matchingIds.push(disp.id);
      }
    }

    // ARC-02: Si la fecha está fuera de la ventana de 15 días o aún no tiene filas de disponibilidad generadas,
    // aprovisionar las franjas horarias correspondientes con bloqueadaMantenimiento: true
    if (disponibilidades.length === 0 && db.servicio?.findUnique) {
      const servicio = await db.servicio.findUnique({
        where: { id: b.servicioId },
        include: { franjasHorarias: true },
      });

      if (servicio && Array.isArray(servicio.franjasHorarias) && servicio.franjasHorarias.length > 0) {
        // diaSemana ISO: 1 (Lunes) a 7 (Domingo)
        const diaSemana = targetDate.getUTCDay() === 0 ? 7 : targetDate.getUTCDay();
        const franjasDelDia = servicio.franjasHorarias.filter(
          (f: { diaSemana: number }) => f.diaSemana === diaSemana,
        );
        const cuposTotales = servicio.modalidad === "EXCLUSIVA" ? 1 : servicio.capacidadMaxima;

        for (const franja of franjasDelDia) {
          const fStart = secondsFromDbTime(new Date(franja.horaInicio));
          const fEnd = secondsFromDbTime(new Date(franja.horaFin));
          const solapa = fStart < endSec && fEnd > startSec;

          if (db.disponibilidad.upsert) {
            await db.disponibilidad.upsert({
              where: {
                servicioId_franjaId_fecha: {
                  servicioId: servicio.id,
                  franjaId: franja.id,
                  fecha: targetDate,
                },
              },
              update: solapa ? { bloqueadaMantenimiento: true } : {},
              create: {
                servicioId: servicio.id,
                franjaId: franja.id,
                fecha: targetDate,
                cuposTotales,
                cuposOcupados: 0,
                bloqueadaMantenimiento: solapa,
              },
            });
          }
        }
      }
    }

    if (matchingIds.length > 0) {
      if (db.disponibilidad.updateMany) {
        await db.disponibilidad.updateMany({
          where: { id: { in: matchingIds } },
          data: { bloqueadaMantenimiento: true },
        });
      } else {
        for (const id of matchingIds) {
          await db.disponibilidad.update({
            where: { id },
            data: { bloqueadaMantenimiento: true },
          });
        }
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
    const targetDateStr = dateInBogota(b.horaInicio);
    const targetDate = new Date(`${targetDateStr}T00:00:00.000Z`);
    const startSec = secondsFromInstant(b.horaInicio);
    const endSec = secondsFromInstant(b.horaFin);

    const disponibilidades = await db.disponibilidad.findMany({
      where: {
        servicioId: b.servicioId,
        fecha: targetDate,
      },
      include: { franja: true },
    });

    const matchingIds: bigint[] = [];
    for (const disp of disponibilidades) {
      if (!disp.franja) continue;
      const fStart = secondsFromDbTime(new Date(disp.franja.horaInicio));
      const fEnd = secondsFromDbTime(new Date(disp.franja.horaFin));

      if (fStart < endSec && fEnd > startSec) {
        matchingIds.push(disp.id);
      }
    }

    if (matchingIds.length > 0) {
      // ARC-03: No reactivar franjas si el servicio posee una inhabilitación activa en la fecha
      const tieneInhabilitacion = db.inhabilitacionServicio?.findFirst
        ? await db.inhabilitacionServicio.findFirst({
            where: {
              servicioId: b.servicioId,
              fechaInicio: { lte: targetDate },
              fechaFin: { gte: targetDate },
            },
          })
        : null;

      if (!tieneInhabilitacion) {
        if (db.disponibilidad.updateMany) {
          await db.disponibilidad.updateMany({
            where: { id: { in: matchingIds } },
            data: { bloqueadaMantenimiento: false },
          });
        } else {
          for (const id of matchingIds) {
            await db.disponibilidad.update({
              where: { id },
              data: { bloqueadaMantenimiento: false },
            });
          }
        }
      }
    }
  }
}

/**
 * Crea un torneo y registra sus bloqueos de pistas de forma atómica y transaccional (ARC-01).
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

  const runOperation = async (tx: any) => {
    // Validar solapamiento preventivo con reservas existentes dentro de la transacción
    if (input.bloqueos && input.bloqueos.length > 0) {
      for (const b of input.bloqueos) {
        const hayConflicto = await verificarConflictoReservas(
          b.servicioId,
          new Date(b.horaInicio),
          new Date(b.horaFin),
          { db: tx },
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

    const torneo = await tx.torneo.create({
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
      await aplicarBloqueosDisponibilidad(input.bloqueos, { db: tx });
    }

    return torneo;
  };

  return db.$transaction ? db.$transaction(runOperation) : runOperation(db);
}

/**
 * Lista torneos con filtros opcionales y paginación controlada (PERF-01).
 */
export async function listarTorneos(
  filtros: ListarTorneosFiltros = {},
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const where: any = {
    eliminadoEn: null,
  };

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

  const findOptions: any = {
    where,
    orderBy: { fechaInicio: "asc" },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
      _count: { select: { inscripciones: true } },
    },
  };

  if (filtros.limit !== undefined) {
    const limit = Math.max(1, Math.min(filtros.limit, 100));
    findOptions.take = limit;
    if (filtros.page !== undefined && filtros.page > 0) {
      findOptions.skip = (filtros.page - 1) * limit;
    }
  }

  return db.torneo.findMany(findOptions);
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

  if (!torneo || torneo.eliminadoEn !== null && torneo.eliminadoEn !== undefined) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  return torneo;
}

/**
 * Matriz de transiciones de estado legales para un torneo (ARC-04).
 */
export const TRANSICIONES_ESTADO_TORNEO: Record<EstadoTorneoValor, readonly EstadoTorneoValor[]> = {
  BORRADOR: ["INSCRIPCIONES_ABIERTAS", "CANCELADO"],
  INSCRIPCIONES_ABIERTAS: ["EN_CURSO", "CANCELADO"],
  EN_CURSO: ["FINALIZADO", "CANCELADO"],
  FINALIZADO: [],
  CANCELADO: [],
};

/**
 * Valida si la transición de estado es válida según el ciclo de vida del torneo (ARC-04).
 */
export function validarTransicionEstadoTorneo(
  estadoActual: EstadoTorneoValor,
  nuevoEstado: EstadoTorneoValor,
): void {
  if (estadoActual === nuevoEstado) return;
  const permitidos = TRANSICIONES_ESTADO_TORNEO[estadoActual] ?? [];
  if (!permitidos.includes(nuevoEstado)) {
    throw new TournamentError(
      `No se permite la transición de estado de ${estadoActual} a ${nuevoEstado}.`,
      "INVALID_STATE_TRANSITION",
      400,
    );
  }
}

/**
 * Actualiza el estado de un torneo de forma transaccional (ARC-01b) y validando FSM (ARC-04).
 */
export async function actualizarEstadoTorneo(
  id: string,
  nuevoEstado: EstadoTorneoValor,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  const runOperation = async (tx: any) => {
    const torneo = await tx.torneo.findUnique({ where: { id } });
    if (!torneo) {
      throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
    }

    validarTransicionEstadoTorneo(torneo.estado as EstadoTorneoValor, nuevoEstado);

    if (nuevoEstado === "CANCELADO") {
      await liberarBloqueosTorneo(id, { db: tx });
    }

    return tx.torneo.update({
      where: { id },
      data: { estado: nuevoEstado },
      include: {
        categoria: true,
        bloqueos: { include: { servicio: true } },
      },
    });
  };

  return db.$transaction ? db.$transaction(runOperation) : runOperation(db);
}

/**
 * Actualiza los campos de un torneo y sus bloqueos de pista atómicamente (ARC-01).
 */
export async function actualizarTorneo(
  id: string,
  input: ActualizarTorneoInput,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  const runOperation = async (tx: any) => {
    const torneo = await tx.torneo.findUnique({
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
      validarTransicionEstadoTorneo(torneo.estado as EstadoTorneoValor, input.estado);
      updateData.estado = input.estado;
      if (input.estado === "CANCELADO") {
        await liberarBloqueosTorneo(id, { db: tx });
      }
    }

    if (input.bloqueos !== undefined) {
      for (const b of input.bloqueos) {
        const hayConflicto = await verificarConflictoReservas(
          b.servicioId,
          new Date(b.horaInicio),
          new Date(b.horaFin),
          { db: tx },
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
      await liberarBloqueosTorneo(id, { db: tx });
      if (tx.torneoBloqueo?.deleteMany) {
        await tx.torneoBloqueo.deleteMany({ where: { torneoId: id } });
      }

      // Registrar nuevos bloqueos
      if (input.bloqueos.length > 0 && tx.torneoBloqueo?.createMany) {
        await tx.torneoBloqueo.createMany({
          data: input.bloqueos.map((b) => ({
            torneoId: id,
            servicioId: b.servicioId,
            horaInicio: new Date(b.horaInicio),
            horaFin: new Date(b.horaFin),
          })),
        });
        await aplicarBloqueosDisponibilidad(input.bloqueos, { db: tx });
      }
    }

    return tx.torneo.update({
      where: { id },
      data: updateData,
      include: {
        categoria: true,
        bloqueos: { include: { servicio: true } },
      },
    });
  };

  return db.$transaction ? db.$transaction(runOperation) : runOperation(db);
}

/**
 * Elimina o cancela un torneo de forma controlada y transaccional (ARC-01):
 * - Si tiene inscripciones registradas o no está en BORRADOR, lo cancela y libera bloqueos.
 * - Si está en BORRADOR sin inscripciones, lo elimina físicamente y libera bloqueos.
 */
export async function eliminarTorneo(
  id: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;

  const runOperation = async (tx: any) => {
    const torneo = await tx.torneo.findUnique({
      where: { id },
      include: {
        bloqueos: true,
        inscripciones: true,
      },
    });

    if (!torneo || torneo.eliminadoEn !== null && torneo.eliminadoEn !== undefined) {
      throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
    }

    await liberarBloqueosTorneo(id, { db: tx });

    const tieneInscripciones =
      Array.isArray(torneo.inscripciones) && torneo.inscripciones.length > 0;

    if (tieneInscripciones || torneo.estado !== "BORRADOR") {
      return tx.torneo.update({
        where: { id },
        data: { estado: "CANCELADO", eliminadoEn: new Date() },
        include: {
          categoria: true,
          bloqueos: { include: { servicio: true } },
        },
      });
    }

    if (tx.torneoBloqueo?.deleteMany) {
      await tx.torneoBloqueo.deleteMany({ where: { torneoId: id } });
    }

    return tx.torneo.update({
      where: { id },
      data: { estado: "CANCELADO", eliminadoEn: new Date() },
    });
  };

  return db.$transaction ? db.$transaction(runOperation) : runOperation(db);
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
      if (inscripcionExistente.estado === "PENDIENTE_PAGO" && !input.confirmado) {
        return inscripcionExistente;
      }
    }

    // HIGH-04: Si se suministra un pagoId, validar atómicamente dentro de la transacción
    // que no haya sido utilizado ya en otra inscripción a cualquier torneo
    if (input.pagoId) {
      const pagoEnUso = await tx.inscripcionTorneo.findFirst({
        where: {
          pagoId: input.pagoId,
          ...(inscripcionExistente ? { id: { not: inscripcionExistente.id } } : {}),
        },
      });
      if (pagoEnUso) {
        throw new TournamentError(
          "El comprobante de pago ya ha sido utilizado en otra inscripción.",
          "PAYMENT_ALREADY_USED",
          409,
        );
      }
    }

    const estadoInicial: EstadoInscripcionTorneoValor = input.confirmado
      ? "CONFIRMADA"
      : Number(torneo.precioInscripcion) === 0
        ? "CONFIRMADA"
        : "PENDIENTE_PAGO";

    if (estadoInicial === "CONFIRMADA") {
      const updateResult = await tx.torneo.updateMany({
        where: {
          id: input.torneoId,
          cuposOcupados: { lt: torneo.cuposTotales },
        },
        data: {
          cuposOcupados: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new TournamentError(
          "No hay cupos disponibles para este torneo.",
          "CAPACITY_EXCEEDED",
          409,
        );
      }
    }

    if (inscripcionExistente) {
      return tx.inscripcionTorneo.update({
        where: { id: inscripcionExistente.id },
        data: {
          nombrePareja: input.nombrePareja?.trim() ?? inscripcionExistente.nombrePareja,
          pagoId: input.pagoId ?? inscripcionExistente.pagoId,
          estado: estadoInicial,
          ticketEstado: estadoInicial === "CONFIRMADA" ? "EMITIDO" : inscripcionExistente.ticketEstado,
        },
        include: {
          torneo: true,
          usuario: { select: { id: true, nombre: true, correo: true } },
        },
      });
    }

    try {
      return await tx.inscripcionTorneo.create({
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
    } catch (err: any) {
      if (err instanceof TournamentError) {
        throw err;
      }
      if (err?.code === "P2002" || err?.message?.includes("Unique constraint")) {
        throw new TournamentError(
          "El usuario ya se encuentra inscrito en este torneo.",
          "ALREADY_REGISTERED",
          409,
        );
      }
      throw err;
    }
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

/**
 * Valida que un pago exista en la base de datos, esté APROBADO, pertenezca al usuario,
 * cubra el monto requerido del torneo y no haya sido utilizado en otra inscripción a un torneo distinto.
 */
export async function verificarPagoParaTorneo(
  identificador: string,
  usuarioId: string,
  montoRequerido: number,
  torneoId?: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      identificador,
    );

  let pago = null;
  if (isUuid) {
    pago = await db.pago.findUnique({
      where: { id: identificador },
    });
  } else {
    pago = await db.pago.findUnique({
      where: { stripePaymentIntentId: identificador },
    });
  }

  if (!pago) return null;
  if (pago.usuarioId !== usuarioId) return null;
  if (pago.estado !== "APROBADO") return null;
  if (pago.tipo !== "TORNEO") return null;
  if (Number(pago.monto) < montoRequerido) return null;

  // Verificar si ya fue utilizado en otra inscripción a un torneo diferente
  const inscripcionConPago = await db.inscripcionTorneo.findFirst({
    where: { pagoId: pago.id },
  });
  if (inscripcionConPago) {
    if (torneoId && inscripcionConPago.torneoId !== torneoId) {
      return null;
    }
    if (inscripcionConPago.usuarioId !== usuarioId) {
      return null;
    }
  }

  return pago;
}

/**
 * Obtiene las inscripciones activas (CONFIRMADA o PENDIENTE_PAGO) de un usuario para una lista de torneos.
 */
export async function obtenerInscripcionesUsuarioParaTorneos(
  usuarioId: string,
  torneoIds: string[],
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  return db.inscripcionTorneo.findMany({
    where: {
      usuarioId,
      torneoId: { in: torneoIds },
      estado: { in: ["CONFIRMADA", "PENDIENTE_PAGO"] },
    },
  });
}

/**
 * Obtiene la inscripción de un usuario a un torneo específico.
 */
export async function obtenerInscripcionUsuario(
  torneoId: string,
  usuarioId: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  return db.inscripcionTorneo.findUnique({
    where: {
      torneoId_usuarioId: { torneoId, usuarioId },
    },
    include: {
      usuario: { select: { id: true, nombre: true, correo: true } },
    },
  });
}

/**
 * Obtiene el detalle público de un torneo sin exponer la lista de inscripciones ni PII de terceros.
 */
export async function obtenerDetallePublicoTorneo(
  id: string,
  options: TournamentDbOptions = {},
) {
  const db = options.db ?? prisma;
  const torneo = await db.torneo.findUnique({
    where: { id },
    include: {
      categoria: true,
      bloqueos: { include: { servicio: true } },
    },
  });

  if (!torneo || torneo.eliminadoEn !== null && torneo.eliminadoEn !== undefined) {
    throw new TournamentError("Torneo no encontrado.", "NOT_FOUND", 404);
  }

  return torneo;
}

