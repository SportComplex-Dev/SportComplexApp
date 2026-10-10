/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

/** Fake DB mínima con semántica de `expirations.test.ts` + tabla `pago`. */
function createFakeDb() {
  const reservas: Array<{
    id: string;
    estado: string;
    pagoId: string | null;
    disponibilidadId: bigint;
    cantidadCupos: number;
  }> = [];
  const pagos: Array<{
    id: string;
    usuarioId: string;
    tipo: string;
    estado: string;
    stripePaymentIntentId: string;
    monto: unknown;
  }> = [];
  const disps = new Map<bigint, { id: bigint; cuposOcupados: number }>();
  let pagoSeq = 1;

  const tx: any = {
    reserva: {
      async findUnique({ where, select }: any) {
        const r = reservas.find((x) => x.id === where.id) ?? null;
        if (!r || !select) return r;
        const picked: any = {};
        for (const key of Object.keys(select)) picked[key] = (r as any)[key];
        return picked;
      },
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const r of reservas) {
          if (where.id !== undefined && r.id !== where.id) continue;
          if (where.estado !== undefined && r.estado !== where.estado) continue;
          Object.assign(r, data);
          count += 1;
        }
        return { count };
      },
    },
    pago: {
      async findUnique({ where }: any) {
        return (
          pagos.find((p) => p.stripePaymentIntentId === where.stripePaymentIntentId) ?? null
        );
      },
      async create({ data }: any) {
        // Emula UNIQUE(stripe_payment_intent_id).
        if (pagos.some((p) => p.stripePaymentIntentId === data.stripePaymentIntentId)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const pago = { id: `pago-${pagoSeq++}`, ...data };
        pagos.push(pago);
        return pago;
      },
    },
    disponibilidad: {
      async update({ where, data }: any) {
        const d = disps.get(where.id);
        if (!d) throw new Error("disp not found");
        if (data.cuposOcupados?.decrement !== undefined) {
          d.cuposOcupados = Math.max(0, d.cuposOcupados - data.cuposOcupados.decrement);
        }
        return d;
      },
    },
  };

  return {
    _reservas: reservas,
    _pagos: pagos,
    _disps: disps,
    $transaction: async (fn: any) => fn(tx),
  };
}

const { attachPendingPagoToReserva, compensateFailedCheckout } = await import(
  "../src/repositories/checkout.ts"
);
const { BookingError } = await import("../src/repositories/bookings.ts");

function seedHold(db: ReturnType<typeof createFakeDb>, overrides: Record<string, unknown> = {}) {
  const dispId = 1n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 2 });
  db._reservas.push({
    id: "r-hold",
    estado: "PENDIENTE_PAGO",
    pagoId: null,
    disponibilidadId: dispId,
    cantidadCupos: 2,
    ...overrides,
  } as never);
}

test("TSK-BE-09: TX2 crea PAGO PENDIENTE y asocia RESERVA.pagoId", async () => {
  const db = createFakeDb();
  seedHold(db);

  const pago = await attachPendingPagoToReserva(
    {
      reservaId: "r-hold",
      stripePaymentIntentId: "pi_ok_1",
      monto: 5000,
      usuarioId: "u-1",
    },
    db,
  );

  assert.equal(pago.tipo, "RESERVA");
  assert.equal(pago.estado, "PENDIENTE");
  assert.equal(pago.stripePaymentIntentId, "pi_ok_1");
  assert.equal(db._reservas[0].pagoId, pago.id);
  assert.equal(db._reservas[0].estado, "PENDIENTE_PAGO");
});

test("TSK-BE-09: TX2 es idempotente por stripe_payment_intent_id (sin duplicados)", async () => {
  const db = createFakeDb();
  seedHold(db);

  const first = await attachPendingPagoToReserva(
    { reservaId: "r-hold", stripePaymentIntentId: "pi_dup_1", monto: 5000, usuarioId: "u-1" },
    db,
  );
  const second = await attachPendingPagoToReserva(
    { reservaId: "r-hold", stripePaymentIntentId: "pi_dup_1", monto: 5000, usuarioId: "u-1" },
    db,
  );

  assert.equal(first.id, second.id);
  assert.equal(db._pagos.length, 1);
  assert.equal(db._reservas[0].pagoId, first.id);
});

test("TSK-BE-09: TX2 reutiliza el PAGO ganador ante violación UNIQUE (P2002)", async () => {
  const db = createFakeDb();
  seedHold(db);
  db._pagos.push({
    id: "pago-preexistente",
    usuarioId: "u-1",
    tipo: "RESERVA",
    estado: "PENDIENTE",
    stripePaymentIntentId: "pi_race_1",
    monto: 5000,
  });

  const pago = await attachPendingPagoToReserva(
    { reservaId: "r-hold", stripePaymentIntentId: "pi_race_1", monto: 5000, usuarioId: "u-1" },
    db,
  );

  assert.equal(pago.id, "pago-preexistente");
  assert.equal(db._pagos.length, 1);
  assert.equal(db._reservas[0].pagoId, "pago-preexistente");
});

test("TSK-BE-09: TX2 rechaza reserva que ya no está PENDIENTE_PAGO (HOLD_EXPIRED)", async () => {
  const db = createFakeDb();
  seedHold(db, { estado: "EXPIRADA" });

  await assert.rejects(
    () =>
      attachPendingPagoToReserva(
        { reservaId: "r-hold", stripePaymentIntentId: "pi_late_1", monto: 5000, usuarioId: "u-1" },
        db,
      ),
    (err: unknown) =>
      err instanceof BookingError &&
      (err as BookingError).code === "HOLD_EXPIRED" &&
      (err as BookingError).status === 409,
  );
});

test("TSK-BE-09: compensación EXPIRA el hold y libera cupos", async () => {
  const db = createFakeDb();
  seedHold(db);

  const released = await compensateFailedCheckout("r-hold", db);

  assert.equal(released, true);
  assert.equal(db._reservas[0].estado, "EXPIRADA");
  assert.equal(db._disps.get(1n)?.cuposOcupados, 0);
});

test("TSK-BE-09: compensación es idempotente (segunda corrida no altera nada)", async () => {
  const db = createFakeDb();
  seedHold(db);

  await compensateFailedCheckout("r-hold", db);
  const second = await compensateFailedCheckout("r-hold", db);

  assert.equal(second, false);
  assert.equal(db._reservas[0].estado, "EXPIRADA");
  assert.equal(db._disps.get(1n)?.cuposOcupados, 0);
});

test("TSK-BE-09: compensación NUNCA degrada una reserva CONFIRMADA", async () => {
  const db = createFakeDb();
  seedHold(db, { estado: "CONFIRMADA" });

  const released = await compensateFailedCheckout("r-hold", db);

  assert.equal(released, false);
  assert.equal(db._reservas[0].estado, "CONFIRMADA");
  assert.equal(db._disps.get(1n)?.cuposOcupados, 2); // cupos intactos.
});
