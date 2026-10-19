import { prisma } from "../../client";
import type { ClienteDb, TxDb } from "../tipos-db";
import { PeriodicidadPlan } from "@prisma/client";
import { calculateRenewalDate } from "../people/memberships";

/**
 * TSK-BD-09 — Idempotencia de pagos con Stripe (HU-10 / RF-09).
 *
 * Un solo punto de entrada para el webhook de Stripe:
 * `procesarPagoWebhook` ejecuta dentro de UNA transacción:
 *   1. Upsert del registro `PAGO` por `stripe_payment_intent_id`
 *      (UNIQUE desde TSK-BD-06 → `pago_stripe_payment_intent_id_key`).
 *   2. Confirmación condicional de las `RESERVA(s)`
 *      (`PENDIENTE_PAGO → CONFIRMADA`, solo si el pago es `APROBADO`) y
 *      emisión del `TICKET_QR` (`EMITIDO`) de cada reserva (TSK-BE-10 / RF-09).
 *   3. Cancelación condicional de las `RESERVA(s)` en pago `FALLIDO`
 *      (`PENDIENTE_PAGO → CANCELADA_PAGO`) con restitución de la franja
 *      (`cupos_ocupados -= cantidad`); el job de TTL (TSK-BD-08) cubre los
 *      checkouts abandonados sin webhook, sin doble liberación.
 *   4. Activación condicional de la `MEMBRESIA` (`→ VIGENTE`, solo `APROBADO`).
 *
 * Garantías de idempotencia:
 * - Reenviar el mismo webhook (mismo `payment_intent`) N veces deja SIEMPRE
 *   UNA sola fila en `pago` y UNA sola transición a `CONFIRMADA`.
 * - La fila la gana quien inserta primero; si dos webhooks concurrentes
 *   compiten por el mismo `stripe_payment_intent_id`, el perdedor recibe
 *   `P2002` (unique violation) y reintenta la transacción completa: al
 *   reintentar ya encuentra la fila existente y NO duplica nada.
 * - Las transiciones de reserva/membresía son updates CONDICIONALES
 *   (`WHERE estado = ...`): exactamente uno gana (`count === 1`); las
 *   corridas siguientes ven `count === 0` y no re-activan.
 * - Una vez `APROBADO`, el pago nunca se degrada a `FALLIDO`/`PENDIENTE`
 *   (un evento tardío de fallo no pisa un pago ya aprobado).
 *
 * Contrato de metadatos Stripe (ver `buildPaymentMetadata` en core):
 *   metadata.bookingId  → reserva o lista CSV de reservas a confirmar
 *   metadata.bookingIds → lista CSV explícita de reservas a confirmar
 *   metadata.userId     → usuario dueño del pago (obligatorio)
 *   metadata.membershipId → membresía a activar (opcional)
 */

export const PAGO_STRIPE_ID_MAX_LENGTH = 100;

const ESTADOS_PAGO = ["PENDIENTE", "APROBADO", "FALLIDO"] as const;
const TIPOS_PAGO = ["RESERVA", "MEMBRESIA"] as const;

export type EstadoPagoValor = (typeof ESTADOS_PAGO)[number];
export type TipoPagoValor = (typeof TIPOS_PAGO)[number];

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export interface ProcesarPagoInput {
  stripePaymentIntentId: string;
  usuarioId: string;
  monto: string | number;
  estado: EstadoPagoValor;
  tipo: TipoPagoValor;
  reservaId?: string | undefined;
  reservaIds?: string[] | undefined;
  membresiaId?: number | undefined;
  ticketCodigoUuid?: string | undefined;
  vendedorId?: string | undefined;
  serviceId?: number | undefined;
}

export interface ProcesarPagoResultado {
  pagoId: string;
  pagoCreado: boolean;
  duplicado: boolean;
  estado: EstadoPagoValor;
  reservaConfirmada: boolean;
  reservaEstado: string | null;
  ticketQrEmitido: boolean;
  ticketReservaId?: string;
  franjaRestituida: boolean;
  membresiaActivada: boolean;
  reservasConfirmadas?: string[];
  reservasEstado?: Record<string, string>;
}

export interface ProcesarPagoOptions {
    db?: ClienteDb;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "P2002" || code === "23505";
}

function normalizeMonto(monto: string | number): string {
  const value = typeof monto === "number" ? monto : Number(monto);
  if (!Number.isFinite(value) || value < 0) {
    throw new PaymentError(
      "El monto debe ser un número mayor o igual a cero.",
      "VALIDATION_ERROR",
      400,
    );
  }
  return value.toFixed(2);
}

function validateInput(input: ProcesarPagoInput): void {
  if (!input.stripePaymentIntentId?.trim()) {
    throw new PaymentError(
      "Falta stripePaymentIntentId (PaymentIntent de Stripe).",
      "VALIDATION_ERROR",
      400,
    );
  }
  if (input.stripePaymentIntentId.length > PAGO_STRIPE_ID_MAX_LENGTH) {
    throw new PaymentError(
      `stripePaymentIntentId supera ${PAGO_STRIPE_ID_MAX_LENGTH} caracteres.`,
      "VALIDATION_ERROR",
      400,
    );
  }
  if (!input.usuarioId?.trim()) {
    throw new PaymentError("Falta usuarioId.", "VALIDATION_ERROR", 400);
  }
  if (!ESTADOS_PAGO.includes(input.estado)) {
    throw new PaymentError(`Estado de pago inválido: ${input.estado}`, "VALIDATION_ERROR", 400);
  }
  if (!TIPOS_PAGO.includes(input.tipo)) {
    throw new PaymentError(`Tipo de pago inválido: ${input.tipo}`, "VALIDATION_ERROR", 400);
  }
  if (input.reservaIds !== undefined) {
    if (!Array.isArray(input.reservaIds)) {
      throw new PaymentError(
        "reservaIds debe ser un array de strings.",
        "VALIDATION_ERROR",
        400,
      );
    }
    for (const id of input.reservaIds) {
      if (!id || typeof id !== "string" || !id.trim()) {
        throw new PaymentError(
          "Cada reservaId debe ser un string no vacío.",
          "VALIDATION_ERROR",
          400,
        );
      }
    }
  }
  const tieneVendedor = input.vendedorId !== undefined;
  const tieneServicio = input.serviceId !== undefined;
  if (tieneVendedor !== tieneServicio) {
    throw new PaymentError(
      "La metadata POS requiere vendedor_id y servicio_id juntos.",
      "INVALID_POS_METADATA",
      400,
    );
  }
  if (
    tieneVendedor &&
    (!input.vendedorId?.trim() || !Number.isSafeInteger(input.serviceId) || (input.serviceId ?? 0) <= 0)
  ) {
    throw new PaymentError("La metadata POS no es válida.", "INVALID_POS_METADATA", 400);
  }
}

type ReservaResumen = {
  id: string;
  estado: string;
  canal?: string;
  vendedorId?: string | null;
  disponibilidad?: {
    servicioId: number;
    fecha?: Date | string;
    franja?: { horaInicio: Date | string; horaFin: Date | string };
  } | null;
  disponibilidadId?: bigint | number | null;
  cantidadCupos?: number | null;
  total?: number | string | { toString(): string } | null;
};

type TicketWindow = { reservaId: string; start: Date; end: Date };

function continuousTicketWindow(reservas: ReservaResumen[]): TicketWindow | null {
  if (reservas.length < 2) return null;
  const windows = reservas.map((reserva) => {
    const disponibilidad = reserva.disponibilidad;
    if (!disponibilidad?.fecha || !disponibilidad.franja) return null;
    const date = disponibilidad.fecha instanceof Date
      ? disponibilidad.fecha.toISOString().slice(0, 10)
      : disponibilidad.fecha.slice(0, 10);
    const localTime = (value: Date | string) =>
      value instanceof Date ? value.toISOString().slice(11, 19) : value.slice(11, 19);
    const start = new Date(`${date}T${localTime(disponibilidad.franja.horaInicio)}-05:00`);
    const end = new Date(`${date}T${localTime(disponibilidad.franja.horaFin)}-05:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
    return { reservaId: reserva.id, serviceId: disponibilidad.servicioId, start, end };
  });
  if (windows.some((window) => window === null)) return null;
  const ordered = (windows as NonNullable<(typeof windows)[number]>[])
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const serviceId = ordered[0]?.serviceId;
  if (!serviceId || ordered.some((window) => window.serviceId !== serviceId)) return null;
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index - 1]?.end.getTime() !== ordered[index]?.start.getTime()) return null;
  }
  const first = ordered[0];
  const last = ordered.at(-1);
  return first && last ? { reservaId: first.reservaId, start: first.start, end: last.end } : null;
}

/**
 * Emite el `TICKET_QR` (estado `EMITIDO`) sin abortar transacciones de Postgres.
 * Se verifica previamente con findUnique para no provocar abortos de bloque transaccional.
 */
async function emitirTicketQr(
  tx: TxDb,
  reservaId: string,
  codigoUuid?: string,
  window?: { start: Date; end: Date },
): Promise<boolean> {
  const existente = await tx.ticketQr.findUnique({ where: { reservaId } });
  if (existente) return false;

  await tx.ticketQr.create({
    data: {
      reservaId,
      ...(codigoUuid ? { codigoUuid } : {}),
      ...(window ? { inicioValidez: window.start, finValidez: window.end } : {}),
      estado: "EMITIDO",
    },
  });
  return true;
}

/**
 * Restituye la franja de una reserva cancelada reutilizando los datos en memoria.
 */
async function restituirFranja(
  tx: TxDb,
  reserva: ReservaResumen,
): Promise<boolean> {
  const disponibilidadId = reserva.disponibilidadId;
  const cantidad = reserva.cantidadCupos as number | undefined;
  if (disponibilidadId == null || !cantidad) return false;

  const disp = await tx.disponibilidad.findUnique({ where: { id: disponibilidadId } });
  const actual = (disp?.cuposOcupados as number | undefined) ?? 0;
  const liberar = Math.min(actual, cantidad);
  if (liberar <= 0) return false;

  await tx.disponibilidad.update({
    where: { id: disponibilidadId },
    data: { cuposOcupados: { decrement: liberar } },
  });
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function procesarIntento(input: ProcesarPagoInput, db: ClienteDb): Promise<ProcesarPagoResultado> {
  const monto = normalizeMonto(input.monto);

  const rawReservaIds =
    input.reservaIds && input.reservaIds.length > 0
      ? input.reservaIds
      : input.reservaId
        ? [input.reservaId]
        : [];
  const targetReservaIds = Array.from(
    new Set(rawReservaIds.map((id) => id.trim()).filter(Boolean)),
  );

  return db.$transaction(async (tx: TxDb) => {
    let reservasExistentes: ReservaResumen[] = [];
    if (targetReservaIds.length > 0) {
      reservasExistentes = (await tx.reserva.findMany({
        where: { id: { in: targetReservaIds } },
        include: {
          disponibilidad: {
            select: {
              servicioId: true,
              fecha: true,
              franja: { select: { horaInicio: true, horaFin: true } },
            },
          },
        },
      })) as ReservaResumen[];

      if (input.vendedorId !== undefined) {
        if (targetReservaIds.length !== 1) {
          throw new PaymentError(
            "Un cobro POS debe corresponder a una sola reserva.",
            "INVALID_POS_METADATA",
            400,
          );
        }
        const reservaPos = reservasExistentes[0];
        if (
          !reservaPos ||
          reservaPos.disponibilidad?.servicioId !== input.serviceId ||
          (reservaPos.vendedorId != null && reservaPos.vendedorId !== input.vendedorId)
        ) {
          throw new PaymentError(
            "La metadata POS no coincide con la reserva.",
            "INVALID_POS_METADATA",
            400,
          );
        }
      }

      const reservasConTotal = reservasExistentes.filter((r) => r.total != null);
      if (reservasConTotal.length > 0) {
        const sumaEsperada = reservasConTotal.reduce(
          (acc: number, r) => acc + Number(r.total ?? 0),
          0,
        );
        if (normalizeMonto(sumaEsperada) !== monto) {
          throw new PaymentError(
            `El monto recibido (${monto}) no coincide con el total esperado de las reservas (${normalizeMonto(sumaEsperada)}).`,
            "AMOUNT_MISMATCH",
            400,
          );
        }
      }
    }

    // 1. Upsert de PAGO
    let pago = await tx.pago.findUnique({
      where: { stripePaymentIntentId: input.stripePaymentIntentId },
    });
    let pagoCreado = false;

    if (!pago) {
      pago = await tx.pago.create({
        data: {
          usuarioId: input.usuarioId,
          membresiaId: input.membresiaId ?? null,
          tipo: input.tipo,
          stripePaymentIntentId: input.stripePaymentIntentId,
          monto,
          estado: input.estado,
        },
      });
      pagoCreado = true;
    } else if (pago.estado !== "APROBADO" && pago.estado !== input.estado) {
      await tx.pago.update({
        where: { id: pago.id },
        data: { estado: input.estado },
      });
      pago = { ...pago, estado: input.estado };
    }

    // 2. Procesamiento de reservas
    let reservaConfirmada = false;
    let reservaEstado: string | null = null;
    let ticketQrEmitido = false;
    let franjaRestituida = false;
    const reservasConfirmadas: string[] = [];
    const reservasEstado: Record<string, string> = {};
    let ticketReservaId: string | undefined;

    if (targetReservaIds.length > 0) {
      if (input.estado === "APROBADO") {
        const pendientes = reservasExistentes.filter((r) => r.estado === "PENDIENTE_PAGO");
        const pendientesIds = pendientes.map((r) => r.id);

        if (pendientesIds.length > 0) {
          const upd = await tx.reserva.updateMany({
            where: { id: { in: pendientesIds }, estado: "PENDIENTE_PAGO" },
            data: {
              estado: "CONFIRMADA",
              pagoId: pago.id,
              ...(input.vendedorId
                ? { vendedorId: input.vendedorId, canal: "TAQUILLA" }
                : {}),
            },
          });
          const count = typeof upd?.count === "number" ? upd.count : 0;
          if (count > 0) {
            reservasConfirmadas.push(...pendientesIds);
            const window = pendientesIds.length === targetReservaIds.length
              ? continuousTicketWindow(reservasExistentes)
              : null;
            if (window) {
              ticketQrEmitido = await emitirTicketQr(
                tx,
                window.reservaId,
                input.ticketCodigoUuid,
                { start: window.start, end: window.end },
              );
              if (ticketQrEmitido) ticketReservaId = window.reservaId;
            } else {
              for (const rId of pendientesIds) {
                const emitido = await emitirTicketQr(
                  tx,
                  rId,
                  pendientesIds.length === 1 ? input.ticketCodigoUuid : undefined,
                );
                if (emitido) {
                  ticketQrEmitido = true;
                }
              }
            }
          }
        }
      } else if (input.estado === "FALLIDO") {
        const pendientes = reservasExistentes.filter((r) => r.estado === "PENDIENTE_PAGO");
        const pendientesIds = pendientes.map((r) => r.id);

        if (pendientesIds.length > 0) {
          const upd = await tx.reserva.updateMany({
            where: { id: { in: pendientesIds }, estado: "PENDIENTE_PAGO" },
            data: { estado: "CANCELADA_PAGO" },
          });
          const count = typeof upd?.count === "number" ? upd.count : 0;
          if (count > 0) {
            for (const r of pendientes) {
              const restituido = await restituirFranja(tx, r);
              if (restituido) franjaRestituida = true;
            }
          }
        }
      }

      const reservasActualizadas = await tx.reserva.findMany({
        where: { id: { in: targetReservaIds } },
      });
      for (const r of reservasActualizadas) {
        if (r.id && r.estado) {
          reservasEstado[r.id] = r.estado;
        }
      }

      const primerId = targetReservaIds[0];
      reservaEstado = reservasEstado[primerId] ?? null;
      reservaConfirmada = reservasConfirmadas.length > 0;
    }

    // 3. Activación de membresía
    let membresiaActivada = false;
    if (input.membresiaId != null && input.estado === "APROBADO") {
      const upd = await tx.membresia.updateMany({
        where: { id: input.membresiaId, estado: { not: "VIGENTE" } },
        data: { estado: "VIGENTE" },
      });
      const count = typeof upd?.count === "number" ? upd.count : 0;
      membresiaActivada = count === 1;
    }

    return {
      pagoId: pago.id as string,
      pagoCreado,
      duplicado: !pagoCreado,
      estado: pago.estado as EstadoPagoValor,
      reservaConfirmada,
      reservaEstado,
      ticketQrEmitido,
      ...(ticketReservaId ? { ticketReservaId } : {}),
      franjaRestituida,
      membresiaActivada,
      reservasConfirmadas,
      reservasEstado,
    };
  }) as Promise<ProcesarPagoResultado>;
}

export async function procesarPagoWebhook(
  input: ProcesarPagoInput,
  options: ProcesarPagoOptions = {},
): Promise<ProcesarPagoResultado> {
  validateInput(input);
  const db = options.db ?? prisma;

  const MAX_INTENTOS = 3;
  let ultimoError: unknown;
  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    try {
      return await procesarIntento(input, db);
    } catch (err: unknown) {
      if (!isUniqueViolation(err)) throw err;
      ultimoError = err;
    }
  }
  throw ultimoError;
}

export interface ProcesarFacturaInput {
  stripeInvoiceId: string;
  stripeSubscriptionId?: string | null;
  stripePaymentIntentId?: string | null;
  usuarioId?: string | null;
  planId?: number | string | null;
  monto: string | number;
  estado: EstadoPagoValor;
  periodEnd?: Date | null;
  membresiaId?: number | null;
}

export interface ProcesarFacturaResultado {
  pagoId: string;
  pagoCreado: boolean;
  duplicado: boolean;
  estado: EstadoPagoValor;
  membresiaRenovada: boolean;
  membresiaVencida: boolean;
  proximaRenovacion: Date | null;
  membresiaId: number | null;
  usuarioId: string;
}

/**
 * TSK-BE-20 (RF-16 / RN-08, RN-09): Procesa eventos de factura recurrente de Stripe (invoice.paid e invoice.payment_failed).
 * - invoice.paid: actualiza/mantiene estado VIGENTE y renueva `proxima_renovacion` (beneficios sin interrupción).
 * - invoice.payment_failed: registra el fallo y transiciona la membresía a VENCIDA.
 * Idempotente ante reenvíos de Stripe por event ID / invoice ID.
 */
export async function procesarFacturaWebhook(
  input: ProcesarFacturaInput,
  options: ProcesarPagoOptions = {},
): Promise<ProcesarFacturaResultado> {
  if (!input.stripeInvoiceId?.trim()) {
    throw new PaymentError("Falta stripeInvoiceId.", "VALIDATION_ERROR", 400);
  }
  if (!ESTADOS_PAGO.includes(input.estado)) {
    throw new PaymentError(`Estado de pago inválido: ${input.estado}`, "VALIDATION_ERROR", 400);
  }
  const db = options.db ?? prisma;
  const monto = normalizeMonto(input.monto);
  const paymentRefId =
    input.stripePaymentIntentId?.trim() || `inv_${input.stripeInvoiceId.trim()}`;

  const MAX_INTENTOS = 3;
  let ultimoError: unknown;

  for (let intento = 1; intento <= MAX_INTENTOS; intento += 1) {
    try {
      return await db.$transaction(async (tx: TxDb): Promise<ProcesarFacturaResultado> => {
        type MembresiaResumen = {
          id: number;
          usuarioId: string;
          estado: string;
          proximaRenovacion: Date;
          stripeSubscriptionId?: string | null;
          plan?: { id?: number; periodicidad?: string } | null;
        };
        let membresia: MembresiaResumen | null = null;
        if (input.membresiaId != null) {
          membresia = await tx.membresia.findUnique({
            where: { id: input.membresiaId },
            include: { plan: true },
          });
        }
        if (!membresia && input.stripeSubscriptionId?.trim()) {
          membresia = await tx.membresia.findFirst({
            where: { stripeSubscriptionId: input.stripeSubscriptionId.trim() },
            include: { plan: true },
          });
        }
        if (!membresia && input.usuarioId?.trim()) {
          membresia = await tx.membresia.findFirst({
            where: {
              usuarioId: input.usuarioId.trim(),
              estado: "VIGENTE",
            },
            include: { plan: true },
          });
          if (!membresia) {
            membresia = await tx.membresia.findFirst({
              where: {
                usuarioId: input.usuarioId.trim(),
              },
              orderBy: { id: "desc" },
              include: { plan: true },
            });
          }
        }

        const resolvedUserId = input.usuarioId?.trim() || membresia?.usuarioId;
        if (!resolvedUserId) {
          throw new PaymentError(
            "No se pudo resolver el usuario asociado a la factura.",
            "MISSING_USER",
            400,
          );
        }

        // Si es el primer cobro exitoso de una suscripción y aún no existe membresía en la BD, se crea (alta de membresía).
        let membresiaRecienCreada = false;
        if (!membresia && input.estado === "APROBADO") {
          const vigenteExistente = await tx.membresia.findFirst({
            where: {
              usuarioId: resolvedUserId,
              estado: "VIGENTE",
            },
            include: { plan: true },
          });

          if (vigenteExistente) {
            membresia = vigenteExistente;
            if (
              vigenteExistente.stripeSubscriptionId &&
              input.stripeSubscriptionId &&
              vigenteExistente.stripeSubscriptionId !== input.stripeSubscriptionId
            ) {
              console.warn(
                `[ALERTA MEMBRESIA] Detectada suscripción concurrente en Stripe para usuario ${resolvedUserId}. Activa previa: ${vigenteExistente.stripeSubscriptionId}, Entrante adicional: ${input.stripeSubscriptionId}`,
              );
            }
          } else {
            const planIdNum = input.planId ? Number(input.planId) : null;
            if (planIdNum && Number.isInteger(planIdNum) && planIdNum > 0) {
              const plan = await tx.planMembresia.findUnique({
                where: { id: planIdNum },
              });
              if (plan) {
                const now = new Date();
                const fechaInicio = now;
                const proximaRenovacion = input.periodEnd
                  ? input.periodEnd
                  : calculateRenewalDate(now, plan.periodicidad as PeriodicidadPlan);

                const nuevaMembresia = await tx.membresia.create({
                  data: {
                    usuarioId: resolvedUserId,
                    planId: plan.id,
                    estado: "VIGENTE",
                    fechaInicio,
                    proximaRenovacion,
                    stripeSubscriptionId: input.stripeSubscriptionId?.trim() || null,
                  },
                  include: { plan: true },
                });
                membresia = nuevaMembresia;
                membresiaRecienCreada = true;
              }
            }
          }
        }

        // 2. Upsert de PAGO
        let pago = await tx.pago.findUnique({
          where: { stripePaymentIntentId: paymentRefId },
        });
        const pagoPrevioEstado = pago?.estado;
        let pagoCreado = false;

        if (!pago) {
          pago = await tx.pago.create({
            data: {
              usuarioId: resolvedUserId,
              membresiaId: membresia ? membresia.id : null,
              tipo: "MEMBRESIA",
              stripePaymentIntentId: paymentRefId,
              monto,
              estado: input.estado,
            },
          });
          pagoCreado = true;
        } else {
          if (pago.estado !== "APROBADO" && pago.estado !== input.estado) {
            await tx.pago.update({
              where: { id: pago.id },
              data: { estado: input.estado },
            });
            pago = { ...pago, estado: input.estado };
          }
          if (membresia && !pago.membresiaId) {
            await tx.pago.update({
              where: { id: pago.id },
              data: { membresiaId: membresia.id },
            });
            pago = { ...pago, membresiaId: membresia.id };
          }
        }

        // Reenvío idempotente si ya estaba previamente aprobado en la BD
        if (pagoPrevioEstado === "APROBADO" && input.estado === "APROBADO") {
          return {
            pagoId: pago.id as string,
            pagoCreado: false,
            duplicado: true,
            estado: "APROBADO",
            membresiaRenovada: false,
            membresiaVencida: false,
            proximaRenovacion: membresia?.proximaRenovacion ?? null,
            membresiaId: membresia?.id ?? null,
            usuarioId: resolvedUserId,
          };
        }

        let membresiaRenovada = false;
        let membresiaVencida = false;
        let proximaRenovacion: Date | null = membresia?.proximaRenovacion ?? null;

        // 3. Actualización de membresía según resultado
        if (input.estado === "APROBADO") {
          if (membresiaRecienCreada) {
            membresiaRenovada = true;
          } else if (membresia) {
            let proximaRenovacionUpdate: Date;
            if (input.periodEnd) {
              proximaRenovacionUpdate = input.periodEnd;
            } else if (membresia.plan?.periodicidad) {
              const base = membresia.proximaRenovacion ? new Date(membresia.proximaRenovacion) : new Date();
              proximaRenovacionUpdate = calculateRenewalDate(base, membresia.plan.periodicidad as PeriodicidadPlan);
            } else {
              proximaRenovacionUpdate = calculateRenewalDate(new Date(), PeriodicidadPlan.MENSUAL);
            }
            proximaRenovacion = proximaRenovacionUpdate;

            await tx.membresia.update({
              where: { id: membresia.id },
              data: {
                estado: "VIGENTE",
                proximaRenovacion: proximaRenovacionUpdate,
                ...(input.stripeSubscriptionId && !membresia.stripeSubscriptionId
                  ? { stripeSubscriptionId: input.stripeSubscriptionId }
                  : {}),
              },
            });
            membresiaRenovada = true;
          }
        } else if (input.estado === "FALLIDO") {
          if (membresia) {
            await tx.membresia.update({
              where: { id: membresia.id },
              data: {
                estado: "VENCIDA",
              },
            });
            membresiaVencida = true;
          }
        }

        return {
          pagoId: pago.id as string,
          pagoCreado,
          duplicado: !pagoCreado,
          estado: pago.estado as EstadoPagoValor,
          membresiaRenovada,
          membresiaVencida,
          proximaRenovacion,
          membresiaId: membresia?.id ?? null,
          usuarioId: resolvedUserId,
        };
      });
    } catch (err: unknown) {
      if (!isUniqueViolation(err)) throw err;
      ultimoError = err;
    }
  }
  throw ultimoError;
}

