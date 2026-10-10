import test from "node:test";
import assert from "node:assert/strict";
import { botTicketQuerySchema } from "../src/bot.schema.ts";

test("botTicketQuerySchema accepts a UUID and SHA-256 hex signature", () => {
  assert.equal(
    botTicketQuerySchema.safeParse({
      ticketId: "9f0d6f4e-0000-4000-8000-000000000001",
      signature: "a".repeat(64),
    }).success,
    true,
  );
});

test("botTicketQuerySchema rejects malformed ticket identifiers and signatures", () => {
  assert.equal(
    botTicketQuerySchema.safeParse({ ticketId: "not-a-uuid", signature: "a".repeat(64) }).success,
    false,
  );
  assert.equal(
    botTicketQuerySchema.safeParse({
      ticketId: "9f0d6f4e-0000-4000-8000-000000000001",
      signature: "bad-signature",
    }).success,
    false,
  );
});
