import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "./mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { BookingError, getBookingHistory } = await import(
  "../src/repositories/bookings.ts"
);

const userId = "00000000-0000-4000-8000-000000000001";

function addBooking(id: string, estado: string, createdAt: string, owner = userId) {
  mock._state.reservas.push({
    id,
    titularId: owner,
    disponibilidadId: 1n,
    estado,
    cantidadCupos: 1,
    creadoEn: new Date(createdAt),
  });
}

test("TSK-BE-13: cada estado del historial contiene reservas disjuntas", async () => {
  mock._state.reservas.length = 0;
  addBooking("00000000-0000-4000-8000-000000000001", "CONFIRMADA", "2026-10-08T10:00:00Z");
  addBooking("00000000-0000-4000-8000-000000000002", "EXPIRADA", "2026-10-08T09:00:00Z");
  addBooking(
    "00000000-0000-4000-8000-000000000003",
    "CANCELADA_ADMINISTRATIVA",
    "2026-10-08T08:00:00Z",
  );
  addBooking("00000000-0000-4000-8000-000000000004", "CONFIRMADA", "2026-10-08T07:00:00Z",
    "00000000-0000-4000-8000-000000000099");

  const confirmed = await getBookingHistory({ userId, estado: "CONFIRMADA" });
  const expired = await getBookingHistory({ userId, estado: "EXPIRADA" });
  const cancelled = await getBookingHistory({
    userId,
    estado: "CANCELADA_ADMINISTRATIVA",
  });

  assert.deepEqual(confirmed.items.map(({ id }) => id), [
    "00000000-0000-4000-8000-000000000001",
  ]);
  assert.deepEqual(expired.items.map(({ id }) => id), [
    "00000000-0000-4000-8000-000000000002",
  ]);
  assert.deepEqual(cancelled.items.map(({ id }) => id), [
    "00000000-0000-4000-8000-000000000003",
  ]);
});

test("TSK-BE-13: el cursor conserva la paginación si se inserta una reserva nueva", async () => {
  mock._state.reservas.length = 0;
  addBooking("00000000-0000-4000-8000-000000000011", "CONFIRMADA", "2026-10-08T10:00:00Z");
  addBooking("00000000-0000-4000-8000-000000000012", "CONFIRMADA", "2026-10-08T09:00:00Z");
  addBooking("00000000-0000-4000-8000-000000000013", "CONFIRMADA", "2026-10-08T08:00:00Z");
  addBooking("00000000-0000-4000-8000-000000000014", "CONFIRMADA", "2026-10-08T07:00:00Z");

  const firstPage = await getBookingHistory({ userId, estado: "CONFIRMADA", limit: 2 });
  assert.equal(firstPage.hasMore, true);
  assert.deepEqual(firstPage.items.map(({ id }) => id), [
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
  ]);

  addBooking("00000000-0000-4000-8000-000000000015", "CONFIRMADA", "2026-10-08T11:00:00Z");
  const secondPage = await getBookingHistory({
    userId,
    estado: "CONFIRMADA",
    cursor: firstPage.nextCursor ?? undefined,
    limit: 2,
  });

  assert.deepEqual(secondPage.items.map(({ id }) => id), [
    "00000000-0000-4000-8000-000000000013",
    "00000000-0000-4000-8000-000000000014",
  ]);
  assert.equal(secondPage.hasMore, false);
});

test("TSK-BE-13: rechaza cursores malformados y límites fuera de rango", async () => {
  await assert.rejects(
    getBookingHistory({
      userId,
      estado: "CONFIRMADA",
      cursor: "invalid",
    }),
    (error: unknown) => error instanceof BookingError && error.code === "INVALID_CURSOR",
  );
  await assert.rejects(
    getBookingHistory({ userId, estado: "CONFIRMADA", limit: 51 }),
    (error: unknown) => error instanceof BookingError && error.code === "INVALID_LIMIT",
  );
});
