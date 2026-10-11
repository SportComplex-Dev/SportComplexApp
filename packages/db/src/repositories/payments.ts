import { prisma } from "../client";

/**
 * TSK-BD-09 — Idempotencia de pagos con Stripe (HU-10 / RF-09).
 *
 * Un solo punto de entrada para el webhook de Stripe:
 * `procesarPagoWebhook` ejecuta dentro de UNA transacción:
 *   1. Upsert del registro `PAGO` por `stripe_payment_intent_id`
 *      (UNIQUE desde TSK-BD-06 → `pago_stripe_payment_intent_id_key`).
 *   2. Confirmación condicional de la `RESERVA`
 *      (`PENDIENTE_PAGO → CONFIRMADA`, solo si el pago es `APROBADO`).
 *   3. Activación condicional de la `MEMBRESIA` (`→ VIGENTE`, solo `APROBADO`).
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
 *   metadata.bookingId  → reserva a confirmar (opcional)
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
  /** `PaymentIntent.id` de Stripe (`pi_...`). Identificador natural único. */
  stripePaymentIntentId: string;
  /** Usuario responsable del pago (FK `pago.usuario_id`, NOT NULL). */
  usuarioId: string;
  /** Monto con 2 decimales (ej. `"75000.00"`). Numérico >= 0. */
  monto: string | number;
  estado: EstadoPagoValor;
  tipo: TipoPagoValor;
  /** Si el pago confirma una reserva individual, su id (`reserva.id`). */
  reservaId?: string | undefined;
  /** Si el pago confirma múltiples reservas (carrito), sus ids (`reserva.id`). */
  reservaIds?: string[] | undefined;
  /** Si el pago activa una membresía, su id (`membresia.id`). */
  membresiaId?: number | undefined;
}

export interface ProcesarPagoResultado {
  pagoId: string;
  /** true solo si ESTA corrida insertó la fila de `pago`. */
  pagoCreado: boolean;
  /** true si la fila de `pago` ya existía (reintento de webhook). */
  duplicado: boolean;
  estado: EstadoPagoValor;
  /** true solo si ESTA corrida ejecutó `PENDIENTE_PAGO → CONFIRMADA`. */
  reservaConfirmada: boolean;
  /** Estado final de la reserva referenciada (si se pasó `reservaId`). */
  reservaEstado: string | null;
  /** true solo si ESTA corrida ejecutó la activación de la membresía. */
  membresiaActivada: boolean;
  /** Lista de IDs de reservas confirmadas en ESTA corrida. */
  reservasConfirmadas?: string[];
  /** Estados finales de todas las reservas procesadas (mapeo id → estado). */
  reservasEstado?: Record<string, string>;
}

type DbLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $transaction: (fn: (tx: any) => Promise<unknown>) => Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface ProcesarPagoOptions {
  /** Cliente inyectable para tests. Por defecto el `prisma` global. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  // P2002 = Prisma unique constraint violation; 23505 = Postgres unique_violation.
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
}

type ReservaResumen = {
  id: string;
  estado: string;
  total?: number | string | { toString(): string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function procesarIntento(input: ProcesarPagoInput, db: any): Promise<ProcesarPagoResultado> {
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

  return db.$transaction(async (tx: DbLike) => {
    // Si hay reservas vinculadas, consultar existentes y validar monto esperado si tienen total definido
    let reservasExistentes: ReservaResumen[] = [];
    if (targetReservaIds.length > 0) {
      reservasExistentes = (await tx.reserva.findMany({
        where: { id: { in: targetReservaIds } },
      })) as ReservaResumen[];

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

    // 1. Upsert de PAGO por identificador natural (stripe_payment_intent_id).
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
      // Solo avanza de estado; jamás degrada un APROBADO.
      await tx.pago.update({
        where: { id: pago.id },
        data: { estado: input.estado },
      });
      pago = { ...pago, estado: input.estado };
    }

    // 2. Confirmación de reserva(s) — update condicional (corazón de la
    //    idempotencia: solo gana quien encuentra PENDIENTE_PAGO).
    let reservaConfirmada = false;
    let reservaEstado: string | null = null;
    const reservasConfirmadas: string[] = [];
    const reservasEstado: Record<string, string> = {};

    if (targetReservaIds.length > 0) {
      if (input.estado === "APROBADO") {
        const pendientes = reservasExistentes.filter((r) => r.estado === "PENDIENTE_PAGO");
        const pendientesIds = pendientes.map((r) => r.id);

        if (pendientesIds.length > 0) {
          const upd = await tx.reserva.updateMany({
            where: { id: { in: pendientesIds }, estado: "PENDIENTE_PAGO" },
            data: { estado: "CONFIRMADA", pagoId: pago.id },
          });
          const count = typeof upd?.count === "number" ? upd.count : 0;
          if (count > 0) {
            reservasConfirmadas.push(...pendientesIds);
          }
        }
      }

      // Consultar estado final de todas las reservas procesadas
      const reservasActualizadas = await tx.reserva.findMany({
        where: { id: { in: targetReservaIds } },
      });
      for (const r of reservasActualizadas) {
        if (r.id && r.estado) {
          reservasEstado[r.id] = r.estado;
        }
      }

      // Compatibilidad campos singulares
      const primerId = targetReservaIds[0];
      reservaEstado = reservasEstado[primerId] ?? null;
      reservaConfirmada = reservasConfirmadas.length > 0;
    }

    // 3. Activación de membresía — condicional e idempotente por el mismo motivo.
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
      membresiaActivada,
      reservasConfirmadas,
      reservasEstado,
    };
  }) as Promise<ProcesarPagoResultado>;
}

/**
 * Procesa un evento de pago de Stripe de forma idempotente.
 *
 * Reintentos de webhook y carreras concurrentes: ante `P2002` (dos eventos
 * compitieron por el mismo `stripe_payment_intent_id`) se reintenta la
 * transacción completa hasta 3 veces; en el reintento la fila ya existe y el
 * resto de la lógica (confirmación/activación) es un no-op condicional.
 */
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
      ultimoError = err; // Carrera por el UNIQUE: reintentar la transacción.
    }
  }
  throw ultimoError;
}
