import test from "node:test";
import assert from "node:assert/strict";
import { analyticsQuerySchema, normalizeAnalyticsQuery } from "../src/analytics.schema.ts";

test("analyticsQuerySchema accepts empty query and valid dates", () => {
  const empty = analyticsQuerySchema.safeParse({});
  assert.equal(empty.success, true);

  const valid = analyticsQuerySchema.safeParse({
    startDate: "2026-10-01",
    endDate: "2026-10-07",
    period: "daily",
  });
  assert.equal(valid.success, true);
});

test("analyticsQuerySchema accepts alias parameters and normalizes correctly", () => {
  const parsed = analyticsQuerySchema.safeParse({
    from: "2026-10-01",
    to: "2026-10-07",
    periodo: "semanal",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    const normalized = normalizeAnalyticsQuery(parsed.data);
    assert.equal(normalized.startDate, "2026-10-01");
    assert.equal(normalized.endDate, "2026-10-07");
    assert.equal(normalized.period, "weekly");
  }
});

test("analyticsQuerySchema rejects startDate > endDate", () => {
  const parsed = analyticsQuerySchema.safeParse({
    startDate: "2026-10-10",
    endDate: "2026-10-05",
  });
  assert.equal(parsed.success, false);
});

test("analyticsQuerySchema rejects malformed date formats", () => {
  for (const badDate of ["10-10-2026", "2026/10/10", "bad-date", "2026-1-1"]) {
    const parsed = analyticsQuerySchema.safeParse({ startDate: badDate });
    assert.equal(parsed.success, false);
  }
});
