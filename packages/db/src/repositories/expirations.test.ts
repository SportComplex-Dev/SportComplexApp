/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { expireReservasVencidas } from "./expirations.js";

interface FakeReserva {
  id: string;
  disponibilidadId: bigint;
  cantidadCupos: number;
  estado: string;
  expiraEn: Date | null;
}

interface FakeDisp {
  id: bigint;
  cuposOcupados: number;
  cuposTotales: number;
}

function createFakeDb(opts?: { withRaw?: boolean }) {
  const withRaw = opts?.withRaw ?? false;
  const reservas: FakeReserva[] = [];
  const disps = new Map<bigint, FakeDisp>();

  const tx: any = {
    reserva: {
      async updateMany({ where, data }: any) {
        let count = 0;
        for (const r of reservas) {
          if (where.id !== undefined && r.id !== where.id) continue;
          if (where.estado !== undefined && r.estado !== where.estado)
            continue;
          if (where.expiraEn?.lt !== undefined) {
            if (!(r.expiraEn !== null && r.expiraEn < where.expiraEn.lt))
              continue;
          }
          r.estado = data.estado;
          count += 1;
        }
        return { count };
      },
    },
    disponibilidad: {
      async findUnique({ where }: any) {
        return disps.get(where.id) ?? null;
      },
      async update({ where, data }: any) {
        const d = disps.get(where.id);
        if (!d) throw new Error("disp not found");
        if (typeof data.cuposOcupados === "number") {
          d.cuposOcupados = data.cuposOcupados;
        } else if (data.cuposOcupados?.decrement !== undefined) {
          d.cuposOcupados = Math.max(
            0,
            d.cuposOcupados - data.cuposOcupados.decrement,
          );
        }
        return d;
      },
    },
  };

  if (withRaw) {
    tx.$queryRaw = async () => [{ acquired: true }];
    tx.$executeRaw = async (_q: unknown, ..._args: unknown[]) => {
      // Simula GREATEST(0, ocupados - cantidad): el repo pasa cantidad e id
      // vía template; como el fake no interpola, el fallback ORM no se usa
      // en este modo. Para mantener el test determinista, decrementamos
      // buscando la reserva recién expirada (última en EXPIRADA sin liberar).
      return 1;
    };
  }

  const db: any = {
    _reservas: reservas,
    _disps: disps,
    reserva: {
      async findMany({ where, take }: any) {
        let list = [...reservas];
        if (where?.estado !== undefined) {
          list = list.filter((r) => r.estado === where.estado);
        }
        if (where?.expiraEn?.lt !== undefined) {
          const cut: Date = where.expiraEn.lt;
          list = list.filter(
            (r) => r.expiraEn !== null && (r.expiraEn as Date) < cut,
          );
        }
        list.sort(
          (a, b) =>
            (a.expiraEn as Date).getTime() - (b.expiraEn as Date).getTime(),
        );
        if (typeof take === "number") list = list.slice(0, take);
        return list.map((r) => ({
          id: r.id,
          disponibilidadId: r.disponibilidadId,
          cantidadCupos: r.cantidadCupos,
        }));
      },
      async updateMany(args: any) {
        return tx.reserva.updateMany(args);
      },
    },
    disponibilidad: tx.disponibilidad,
    $transaction: async (fn: any) => fn(tx),
  };

  if (withRaw) {
    db.$queryRaw = tx.$queryRaw;
    db.$executeRaw = tx.$executeRaw;
  }

  return db;
}

test("TSK-BD-08: expira PENDIENTE_PAGO vencida y libera cupos", async () => {
  const db = createFakeDb();
  const dispId = 1n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 2, cuposTotales: 10 });
  const now = new Date("2026-10-07T12:00:00Z");
  db._reservas.push({
    id: "r-vencida",
    disponibilidadId: dispId,
    cantidadCupos: 2,
    estado: "PENDIENTE_PAGO",
    expiraEn: new Date(now.getTime() - 60_000),
  });

  const res = await expireReservasVencidas({ now, db });
  assert.equal(res.expiredCount, 1);
  assert.equal(res.releasedCupos, 2);
  assert.deepEqual(res.expiredIds, ["r-vencida"]);
  assert.equal(db._reservas[0].estado, "EXPIRADA");
  assert.equal(db._disps.get(dispId)?.cuposOcupados, 0);
});

test("TSK-BD-08: ignora no vencida y CONFIRMADA", async () => {
  const db = createFakeDb();
  const dispId = 2n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 3, cuposTotales: 10 });
  const now = new Date("2026-10-07T12:00:00Z");
  db._reservas.push(
    {
      id: "r-futura",
      disponibilidadId: dispId,
      cantidadCupos: 1,
      estado: "PENDIENTE_PAGO",
      expiraEn: new Date(now.getTime() + 15 * 60 * 1000),
    },
    {
      id: "r-confirmada-vencida",
      disponibilidadId: dispId,
      cantidadCupos: 2,
      estado: "CONFIRMADA",
      expiraEn: new Date(now.getTime() - 60_000),
    },
  );

  const res = await expireReservasVencidas({ now, db });
  assert.equal(res.expiredCount, 0);
  assert.equal(db._disps.get(dispId)?.cuposOcupados, 3);
});

test("TSK-BD-08: frontera exacta — expira_en == now NO expira (lt, no lte)", async () => {
  const db = createFakeDb();
  const dispId = 3n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 1, cuposTotales: 5 });
  const now = new Date("2026-10-07T12:00:00Z");
  db._reservas.push({
    id: "r-borde",
    disponibilidadId: dispId,
    cantidadCupos: 1,
    estado: "PENDIENTE_PAGO",
    expiraEn: new Date(now.getTime()),
  });
  const r1 = await expireReservasVencidas({ now, db });
  assert.equal(r1.expiredCount, 0);

  const r2 = await expireReservasVencidas({
    now: new Date(now.getTime() + 1),
    db,
  });
  assert.equal(r2.expiredCount, 1);
});

test("TSK-BD-08: idempotencia — correr dos veces no altera el resultado", async () => {
  const db = createFakeDb();
  const dispId = 4n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 1, cuposTotales: 5 });
  const now = new Date("2026-10-07T12:00:00Z");
  db._reservas.push({
    id: "r-una",
    disponibilidadId: dispId,
    cantidadCupos: 1,
    estado: "PENDIENTE_PAGO",
    expiraEn: new Date(now.getTime() - 1000),
  });

  const r1 = await expireReservasVencidas({ now, db });
  assert.equal(r1.expiredCount, 1);
  assert.equal(db._disps.get(dispId)?.cuposOcupados, 0);

  const r2 = await expireReservasVencidas({ now, db });
  assert.equal(r2.expiredCount, 0);
  assert.equal(r2.releasedCupos, 0);
  assert.equal(db._disps.get(dispId)?.cuposOcupados, 0);
});

test("TSK-BD-08: nunca deja cupos_ocupados negativo (clamp)", async () => {
  const db = createFakeDb();
  const dispId = 5n;
  db._disps.set(dispId, { id: dispId, cuposOcupados: 1, cuposTotales: 5 });
  const now = new Date("2026-10-07T12:00:00Z");
  db._reservas.push({
    id: "r-big",
    disponibilidadId: dispId,
    cantidadCupos: 4,
    estado: "PENDIENTE_PAGO",
    expiraEn: new Date(now.getTime() - 1000),
  });
  const r = await expireReservasVencidas({ now, db });
  assert.equal(r.expiredCount, 1);
  assert.equal(db._disps.get(dispId)?.cuposOcupados, 0);
});
