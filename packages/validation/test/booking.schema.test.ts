import test from "node:test";
import assert from "node:assert/strict";
import { availabilityQuerySchema, bookingRequestSchema } from "../src/booking.schema.ts";

test("bookingRequestSchema accepts integer service IDs and defaults to one seat", () => {
  const parsed = bookingRequestSchema.safeParse({
    serviceId: "12",
    startTime: "2026-10-08T15:00:00.000Z",
    endTime: "2026-10-08T16:00:00.000Z",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.serviceId, 12);
    assert.equal(parsed.data.cantidadCupos, 1);
  }
});

test("bookingRequestSchema rejects invalid IDs, cupos, and timestamps", () => {
  for (const payload of [
    { serviceId: "bad", startTime: "2026-10-08T15:00:00Z", endTime: "2026-10-08T16:00:00Z" },
    { serviceId: 1, startTime: "2026-10-08", endTime: "2026-10-08T16:00:00Z" },
    {
      serviceId: 1,
      startTime: "2026-10-08T15:00:00Z",
      endTime: "2026-10-08T16:00:00Z",
      cantidadCupos: 0,
    },
  ]) {
    assert.equal(bookingRequestSchema.safeParse(payload).success, false);
  }
});

test("availabilityQuerySchema validates service and calendar date", () => {
  assert.equal(
    availabilityQuerySchema.safeParse({ serviceId: "12", date: "2026-10-08" }).success,
    true,
  );
  assert.equal(
    availabilityQuerySchema.safeParse({ serviceId: "0", date: "2026-02-30" }).success,
    false,
  );
});
