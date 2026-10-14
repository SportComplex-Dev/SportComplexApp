import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../client";
import { BookingError } from "./bookings";

/**
 * TSK-BE-09 / RF-09 — liberación y asociación de pagos del checkout.
 *
 * Contrato (opción C aprobada):
 * - TX1 (`createBookingHold` en `bookings.ts`) crea `RESERVA` en
 *   `PENDIENTE_PAGO` con `expira_en = now + 30 min` y `pagoId = NULL`.
 * - TSK-BE-09 NO crea ni asocia `PAGO` durante el lock: la API actual de
 *   Stripe no expone el `pi_...` hasta `checkout.session.completed`.
 * - RF-09 (webhook Stripe) usará `checkout.session.metadata.bookingId`
 *   para localizar la `RESERVA` y llamará a `attachPendingPagoToReserva`
 *   con el `pi_...` real, respetando `stripe_payment_intent_id NOT NULL UNIQUE`.
 * - Si Stripe falla tras TX1, `compensateFailedCheckout` ejecuta la misma
 *   transición idempotente que el job de expiración:
 *   `PENDIENTE_PAGO → EXPIRADA` + `cupos_ocupados -= N`, sin crear `PAGO`.
 *
 * `PENDIENTE_PAGO → CONFIRMADA` y `PAGO → APROBADO/FALLIDO` quedan fuera de
 * TSK-BE-09 (pertenecen al webhook RF-09).
 */

export interface AttachPendingPagoInput {
  reservaId: string;
  stripePaymentIntentId: string;
  /** Monto final cobrado; debe coincidir con `RESERVA.total`. */
  monto: number | string | Prisma.Decimal;
  usuarioId: string;
  membresiaId?: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbLike = PrismaClient | any;

function isP2002UniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * RF-09 (webhook) — crea `PAGO` (`tipo=RESERVA`, `estado=PENDIENTE`) y lo
 * asocia a la `RESERVA` bloqueada. NO usar desde el lock (TSK-BE-09): el
 * `pi_...` solo existe tras `checkout.session.completed`.
 *
 * Idempotente por `stripe_payment_intent_id` (UNIQUE): lookup previo +
 * captura de P2002 reutilizan el PAGO existente.
 *
 * @throws BookingError `HOLD_EXPIRED`(409) si la reserva ya no está en
 *   `PENDIENTE_PAGO`.
 */
export async function attachPendingPagoToReserva(
  input: AttachPendingPagoInput,
  db: DbLike = prisma,
) {
  const piId = input.stripePaymentIntentId;
  if (typeof piId !== "string" || !piId.startsWith("pi_")) {
    throw new BookingError(
      "El paymentIntentId de Stripe no es válido.",
      "INVALID_PAYMENT_INTENT",
      400,
    );
  }

  return db.$transaction(async (tx: DbLike) => {
    const existing = await tx.pago.findUnique({
      where: { stripePaymentIntentId: piId },
    });
    if (existing) {
      await ensureReservaLinked(tx, input.reservaId, existing.id);
      return existing;
    }

    let pago;
    try {
      pago = await tx.pago.create({
        data: {
          usuarioId: input.usuarioId,
          membresiaId: input.membresiaId ?? null,
          tipo: "RESERVA",
          stripePaymentIntentId: piId,
          monto: input.monto,
          estado: "PENDIENTE",
        },
      });
    } catch (err) {
      if (isP2002UniqueViolation(err)) {
        // Carrera: otro proceso creó el PAGO con el mismo PI. Reutilizarlo.
        const raced = await tx.pago.findUnique({
          where: { stripePaymentIntentId: piId },
        });
        if (raced) {
          await ensureReservaLinked(tx, input.reservaId, raced.id);
          return raced;
        }
      }
      throw err;
    }

    await ensureReservaLinked(tx, input.reservaId, pago.id);
    return pago;
  });
}

/**
 * Enlaza `RESERVA.pagoId` de forma condicional: solo si la reserva sigue en
 * `PENDIENTE_PAGO`. Lanza `HOLD_EXPIRED` cuando el bloqueo ya no existe.
 */
async function ensureReservaLinked(
  tx: DbLike,
  reservaId: string,
  pagoId: string,
): Promise<void> {
  const reserva = await tx.reserva.findUnique({
    where: { id: reservaId },
    select: { estado: true, pagoId: true },
  });
  if (!reserva) {
    throw new BookingError("La reserva no existe.", "HOLD_EXPIRED", 409);
  }
  if (reserva.pagoId === pagoId) return; // ya enlazada, idempotente.
  if (reserva.estado !== "PENDIENTE_PAGO") {
    throw new BookingError(
      "El bloqueo temporal de la reserva ya expiró o fue confirmado.",
      "HOLD_EXPIRED",
      409,
    );
  }
  const linked = await tx.reserva.updateMany({
    where: { id: reservaId, estado: "PENDIENTE_PAGO" },
    data: { pagoId },
  });
  const count = typeof linked?.count === "number" ? linked.count : 0;
  if (count !== 1 && reserva.pagoId !== pagoId) {
    throw new BookingError(
      "El bloqueo temporal de la reserva ya expiró o fue confirmado.",
      "HOLD_EXPIRED",
      409,
    );
  }
}

/**
 * Compensación — Stripe falló después de TX1: liberar el hold para que no
 * quede bloqueo huérfano. Nunca crea `PAGO`.
 *
 * Misma transición que `expireReservasVencidas`: `PENDIENTE_PAGO → EXPIRADA`
 * con guarda condicional (idempotente; si el job o la limpieza perezosa ya
 * la liberaron, `count === 0` y no se tocan los cupos de nuevo).
 *
 * Importante: una reserva que ya salió de `PENDIENTE_PAGO` (p.ej. webhook la
 * confirmó en la ventana de fallo) NUNCA se degrada a `EXPIRADA` ni pierde
 * cupos.
 *
 * @returns `true` si esta llamada ejecutó la liberación; `false` si otro
 *   proceso ya lo había hecho (o la reserva ya no estaba pendiente).
 */
export async function compensateFailedCheckout(
  reservaId: string,
  db: DbLike = prisma,
  now: Date = new Date(),
): Promise<boolean> {
  void now; // firma alineada con expirations.ts; la guarda no depende de `now`.
  return db.$transaction(async (tx: DbLike) => {
    const reserva = await tx.reserva.findUnique({
      where: { id: reservaId },
      select: {
        id: true,
        estado: true,
        disponibilidadId: true,
        cantidadCupos: true,
      },
    });
    if (!reserva || reserva.estado !== "PENDIENTE_PAGO") {
      return false;
    }

    const upd = await tx.reserva.updateMany({
      where: { id: reservaId, estado: "PENDIENTE_PAGO" },
      data: { estado: "EXPIRADA" },
    });
    const count = typeof upd?.count === "number" ? upd.count : 0;
    if (count !== 1) return false; // liberada concurrentemente.

    // Liberar cupos sin bajar de cero (mismo patrón que expirations.ts).
    let released = false;
    if (typeof tx.$executeRaw === "function") {
      try {
        await tx.$executeRaw`UPDATE "disponibilidad" SET "cupos_ocupados" = GREATEST(0, "cupos_ocupados" - ${reserva.cantidadCupos}) WHERE id = ${reserva.disponibilidadId}`;
        released = true;
      } catch {
        released = false;
      }
    }
    if (!released && tx.disponibilidad) {
      try {
        await tx.disponibilidad.update({
          where: { id: reserva.disponibilidadId },
          data: { cuposOcupados: { decrement: reserva.cantidadCupos } },
        });
      } catch {
        // La reserva ya quedó EXPIRADA (idempotente); el cupo se reconcilia
        // con la próxima corrida del job contra Postgres real.
      }
    }
    return true;
  });
}
