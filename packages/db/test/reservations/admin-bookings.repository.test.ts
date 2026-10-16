/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma } from "../mock-prisma.ts";

const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { listAdminBookings } = await import(
  "../../src/repositories/reservations/bookings/admin-bookings.ts"
);

test("TSK-BE-27 / SCRUM-212: listAdminBookings retorna estructura paginada y métricas", async () => {
  const result = await listAdminBookings({ limit: 10, offset: 0 });
  assert.ok(result);
  assert.ok(Array.isArray(result.items));
  assert.equal(typeof result.total, "number");
  assert.equal(result.limit, 10);
  assert.equal(result.offset, 0);
  assert.equal(typeof result.hasMore, "boolean");
  assert.ok(result.metrics);
  assert.equal(typeof result.metrics.todayTotal, "number");
  assert.equal(typeof result.metrics.confirmedCount, "number");
  assert.equal(typeof result.metrics.pendingCount, "number");
  assert.ok(Array.isArray(result.metrics.byService));
});

test("TSK-BE-27 / SCRUM-212: listAdminBookings acota límites de paginación", async () => {
  const clampedMin = await listAdminBookings({ limit: -10 });
  assert.equal(clampedMin.limit, 1);

  const clampedMax = await listAdminBookings({ limit: 500 });
  assert.equal(clampedMax.limit, 100);

  const clampedOffset = await listAdminBookings({ offset: -5 });
  assert.equal(clampedOffset.offset, 0);
});
