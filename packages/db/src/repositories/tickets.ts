import { prisma } from "../client";

/**
 * TSK-BD-10 — Canje de ticket y pista de auditoría de accesos (HU-14..17).
 *
 * RF-13/RF-14/RF-15 · RN-05 (ciclo irreversible EMITIDO → USADO).
 *
 * `ejecutarLectura` es el ÚNICO punto de escritura de `TICKET_QR` y
 * `LECTURA_ACCESO`. Dentro de UNA transacción:
 *
 * 1. Canje (modo TURNO + decisión consumir):
 *    `UPDATE ticket_qr SET estado='USADO', usado_por, usado_en
 *       WHERE id = :id AND estado = 'EMITIDO'`
 *    → exactamente uno gana (`count === 1`); un reintento/carrera ve
 *    `count === 0`, NO altera el boleto y registra `DENEGADO_USADO`.
 *    La irreversibilidad la garantiza el WHERE del motor, no el código:
 *    un boleto `USADO` jamás vuelve a `EMITIDO`.
 * 2. Toda lectura escribe EXACTAMENTE UNA fila en `LECTURA_ACCESO`
 *    (RF-15 / pista de auditoría): `CONCEDIDO`, `DENEGADO_*` o `CONSULTA`.
 * 3. Modo CONSULTA: solo insert de auditoría (`resultado = 'CONSULTA'`,
 *    `asignacion_id = NULL`) — cero updates sobre el boleto (RN-05).
 *
 * La decisión de negocio (firma, ventana, servicio) vive fuera:
 * `decideAccess()` en @sportcomplex/core + orquestador `lib/access.ts`.
 */

export type ModoLecturaValor = "TURNO" | "CONSULTA";

export type ResultadoLecturaValor =
  | "CONCEDIDO"
  | "DENEGADO_SERVICIO"
  | "DENEGADO_HORARIO"
  | "DENEGADO_USADO"
  | "CONSULTA";

export class TicketError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TicketError";
  }
}

export interface TicketParaEscaneo {
  id: string;
  codigoUuid: string;
  estado: "EMITIDO" | "USADO";
  usadoPor: string | null;
  usadoEn: Date | null;
  reserva: {
    id: string;
    titularId: string;
    titular: { id: string; nombre: string };
    disponibilidad: {
      fecha: Date;
      servicio: { id: number; nombre: string };
      franja: { horaInicio: Date; horaFin: Date };
    };
  };
}

export interface EjecutarLecturaInput {
  ticketId: string;
  modo: ModoLecturaValor;
  /** Resultado provisional; el canje pierde la carrera → DENEGADO_USADO. */
  resultado: ResultadoLecturaValor;
  /** true solo en TURNO con decisión "consumir" (allowed && consume). */
  consumir: boolean;
  empleadoId: string;
  /** Obligatorio nulo en modo CONSULTA (RF-15: "ampara 0..1, nulo en consulta"). */
  asignacionId: number | null;
  now?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

export interface ResultadoLecturaSalida {
  /** true solo si ESTA corrida transmutó EMITIDO → USADO. */
  canjeado: boolean;
  /** Resultado final persistido en LECTURA_ACCESO (puede corregir la carrera). */
  resultado: ResultadoLecturaValor;
  /** `lectura_acceso.id` (BigInt). */
  lecturaId: bigint;
  /** Estado final del boleto tras la corrida. */
  ticketEstado: "EMITIDO" | "USADO";
}

type TicketRow = {
  id: string;
  estado: "EMITIDO" | "USADO";
};

/**
 * Carga el ticket por su contenido de QR (`codigo_uuid`) con reserva,
 * titular, servicio y franja — todo lo que necesita la decisión de acceso.
 * Lanza `TicketError` (404) si el código no existe.
 */
export async function getTicketForScan(
  codigoUuid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any = prisma,
): Promise<TicketParaEscaneo> {
  const ticket = await db.ticketQr.findUnique({
    where: { codigoUuid },
    include: {
      reserva: {
        include: {
          titular: { select: { id: true, nombre: true } },
          disponibilidad: {
            include: { servicio: true, franja: true },
          },
        },
      },
    },
  });
  if (!ticket) {
    throw new TicketError(
      "El código QR no corresponde a un ticket existente.",
      "TICKET_NOT_FOUND",
      404,
    );
  }
  return ticket as TicketParaEscaneo;
}

/**
 * Asignación de puesto vigente del lector para el servicio escaneado.
 * Best-effort: si el lector no tiene turno registrado, se audita con
 * `asignacion_id = NULL` (la columna es nullable; el flujo de turnos es
 * una task aparte). Nunca bloquea el canje.
 */
export async function getAsignacionVigente(
  empleadoId: string,
  servicioId: number,
  now: Date,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any = prisma,
): Promise<{ id: number } | null> {
  const asignacion = await db.asignacionPuesto.findFirst({
    where: {
      empleadoId,
      servicioId,
      inicioTurno: { lte: now },
      finTurno: { gte: now },
    },
    orderBy: { inicioTurno: "desc" },
    select: { id: true },
  });
  return asignacion ?? null;
}

/**
 * Ejecuta la lectura decidida: canje condicional + auditoría obligatoria,
 * en una sola transacción. Idempotente por diseño (ver docblock superior).
 */
export async function ejecutarLectura(
  input: EjecutarLecturaInput,
): Promise<ResultadoLecturaSalida> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  if (input.modo === "CONSULTA" && input.asignacionId !== null) {
    throw new TicketError(
      "En modo CONSULTA el asignacion_id debe ser nulo.",
      "VALIDATION_ERROR",
      400,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db.$transaction(async (tx: any) => {
    let resultado: ResultadoLecturaValor = input.resultado;
    let canjeado = false;

    if (input.consumir) {
      // Corazón de la idempotencia: WHERE estado='EMITIDO' (RN-05).
      const upd = await tx.ticketQr.updateMany({
        where: { id: input.ticketId, estado: "EMITIDO" },
        data: {
          estado: "USADO",
          usadoPor: input.empleadoId,
          usadoEn: now,
        },
      });
      const count = typeof upd?.count === "number" ? upd.count : 0;
      if (count === 1) {
        canjeado = true;
        resultado = "CONCEDIDO";
      } else {
        // Otra corrida canjeó primero: no tocar el boleto, auditar denegación.
        resultado = "DENEGADO_USADO";
      }
    }

    // Auditoría obligatoria: exactamente UNA fila por lectura (RF-15).
    const lectura = await tx.lecturaAcceso.create({
      data: {
        ticketId: input.ticketId,
        empleadoId: input.empleadoId,
        asignacionId: input.modo === "CONSULTA" ? null : input.asignacionId,
        modo: input.modo,
        resultado,
        fechaHora: now,
      },
    });

    const fila = (await tx.ticketQr.findUnique({
      where: { id: input.ticketId },
      select: { estado: true },
    })) as TicketRow | null;

    return {
      canjeado,
      resultado,
      lecturaId: lectura.id as bigint,
      ticketEstado: (fila?.estado ?? "EMITIDO") as "EMITIDO" | "USADO",
    };
  }) as Promise<ResultadoLecturaSalida>;
}
