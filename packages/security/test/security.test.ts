import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  newTicketId,
  signTicket,
  verifyTicketSignature,
  isValidTicketId,
  buildTicketQrPayload,
  parseTicketQrPayload,
  TICKET_QR_PREFIX,
} from "../dist/qr/index.js";
import {
  generateVerificationCode,
  hashSecret,
  verifySecret,
  isTokenExpired,
  isResendAllowed,
  TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  VERIFICATION_CODE_LENGTH,
} from "../dist/token/index.js";
import { createPasswordResetToken, verifyPasswordResetToken, isPasswordResetTokenCurrent, PASSWORD_RESET_TTL_MS } from "../dist/token/index.js";
import { sendPasswordResetEmail } from "../dist/correo/index.js";
import {
  consumeRateLimit,
  resetRateLimit,
} from "../dist/limite-tasa/index.js";
import {
  buildPaymentMetadata,
  parsePaymentMetadata,
  buildPosPaymentIntentParams,
  buildCheckoutSessionParams,
  extractPaymentIntentId,
  stripeSessionExpiresAtSec,
  STRIPE_CURRENCY,
} from "../dist/stripe/index.js";
import {
  isDateHoliday,
  normalizeToNagerHoliday,
  MemoryHolidayCacheStore,
  getColombiaHolidays,
} from "../dist/festivos/index.js";

test("QR: signing and verification", () => {
  const secret = "test-secret-key-32-chars-minimum!";
  const ticketId = newTicketId();
  assert.ok(isValidTicketId(ticketId));

  const signature = signTicket(ticketId, secret);
  assert.equal(signature.length, 64);
  assert.ok(verifyTicketSignature(ticketId, signature, secret));
  assert.ok(!verifyTicketSignature(ticketId, signature, "wrong-secret"));
  assert.ok(!verifyTicketSignature(newTicketId(), signature, secret));

  const payload = buildTicketQrPayload(ticketId, signature);
  assert.ok(payload.startsWith(`${TICKET_QR_PREFIX}:`));

  const parsed = parseTicketQrPayload(payload);
  assert.deepEqual(parsed, { ticketId, signature });

  assert.equal(parseTicketQrPayload("invalid:payload"), null);
  assert.equal(parseTicketQrPayload(`${TICKET_QR_PREFIX}:not-uuid:${signature}`), null);
});

test("Token: verification code, Argon2id hashing and expiration", async () => {
  const code = generateVerificationCode();
  assert.equal(code.length, VERIFICATION_CODE_LENGTH);
  assert.match(code, /^\d{6}$/);

  const hash = await hashSecret(code);
  assert.ok(hash.startsWith("$argon2id$"));

  const isValid = await verifySecret(hash, code);
  assert.equal(isValid, true);

  const isInvalid = await verifySecret(hash, "000000");
  assert.equal(isInvalid, false);

  const now = new Date("2026-10-14T12:00:00Z");
  const unexpired = new Date(now.getTime() + TOKEN_TTL_MS);
  const expired = new Date(now.getTime() - 1000);

  assert.equal(isTokenExpired(unexpired, now), false);
  assert.equal(isTokenExpired(expired, now), true);

  const recentlyCreated = new Date(now.getTime() - 30_000); // 30s ago
  const oldEnough = new Date(now.getTime() - RESEND_COOLDOWN_MS); // 60s ago

  assert.equal(isResendAllowed(recentlyCreated, now), false);
  assert.equal(isResendAllowed(oldEnough, now), true);
});

test("Password reset: firma, TTL de 15 minutos y rechazo de alteraciones", () => {
  process.env.AUTH_RESET_TOKEN_SECRET = "test-reset-secret-with-at-least-32-chars";
  const now = new Date("2026-10-15T12:00:00Z");
  const token = createPasswordResetToken({ id: "user-id", email: "test@example.com", passwordHash: "$argon2id$old" }, now);
  const claims = verifyPasswordResetToken(token, now);
  assert.equal(claims?.userId, "user-id");
  assert.equal(claims?.email, "test@example.com");
  assert.ok(claims?.credentialVersion);
  assert.equal(isPasswordResetTokenCurrent(claims!.credentialVersion, "$argon2id$old"), true);
  assert.equal(isPasswordResetTokenCurrent(claims!.credentialVersion, "$argon2id$new"), false);
  assert.equal(verifyPasswordResetToken(token, new Date(now.getTime() + PASSWORD_RESET_TTL_MS)), null);
  assert.equal(verifyPasswordResetToken(`${token}x`, now), null);
});

test("Password reset email: firma el payload para n8n y no reintenta", async () => {
  const previousUrl = process.env.N8N_PASSWORD_RESET_WEBHOOK_URL;
  const previousSecret = process.env.N8N_PASSWORD_RESET_HMAC_SECRET;
  const previousFetch = globalThis.fetch;
  const secret = "test-reset-webhook-secret-with-32-chars";
  let receivedUrl = "";
  let receivedBody = "";
  let receivedSignature = "";

  process.env.N8N_PASSWORD_RESET_WEBHOOK_URL = "https://n8n.example/webhook/auth-password-reset";
  process.env.N8N_PASSWORD_RESET_HMAC_SECRET = secret;
  globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    receivedUrl = request.url;
    receivedBody = await request.text();
    receivedSignature = request.headers.get("X-SportComplex-Signature") ?? "";
    return new Response(null, { status: 200 });
  };

  try {
    await sendPasswordResetEmail({
      usuarioId: "user-1",
      to: "ana@example.com",
      nombre: "Ana",
      resetUrl: "https://sportcomplex.example/reset-password?token=abc",
    });
    const expected = createHmac("sha256", secret).update(receivedBody).digest("hex");
    assert.equal(receivedUrl, "https://n8n.example/webhook/auth-password-reset");
    assert.equal(receivedSignature, `sha256=${expected}`);
    assert.match(receivedBody, /"tipo":"password_reset"/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.N8N_PASSWORD_RESET_WEBHOOK_URL;
    else process.env.N8N_PASSWORD_RESET_WEBHOOK_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.N8N_PASSWORD_RESET_HMAC_SECRET;
    else process.env.N8N_PASSWORD_RESET_HMAC_SECRET = previousSecret;
  }
});

test("Limite Tasa: consume and reset", () => {
  const key = "test-user-limit";
  resetRateLimit(key);

  const start = Date.now();
  const res1 = consumeRateLimit(key, 3, 10_000, start);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remaining, 2);

  const res2 = consumeRateLimit(key, 3, 10_000, start);
  assert.equal(res2.allowed, true);
  assert.equal(res2.remaining, 1);

  const res3 = consumeRateLimit(key, 3, 10_000, start);
  assert.equal(res3.allowed, true);
  assert.equal(res3.remaining, 0);

  const res4 = consumeRateLimit(key, 3, 10_000, start);
  assert.equal(res4.allowed, false);
  assert.equal(res4.remaining, 0);
  assert.ok(res4.retryAfterSeconds > 0);

  resetRateLimit(key);
  const resAfterReset = consumeRateLimit(key, 3, 10_000, start);
  assert.equal(resAfterReset.allowed, true);
  assert.equal(resAfterReset.remaining, 2);
});

test("Stripe: metadata building and parsing", () => {
  const meta = buildPaymentMetadata({
    bookingId: "b-123,b-456",
    userId: "u-999",
    serviceId: 5,
    vendedorId: "v-1",
  });

  assert.equal(meta.bookingId, "b-123,b-456");
  assert.equal(meta.userId, "u-999");
  assert.equal(meta.servicio_id, "5");
  assert.equal(meta.vendedor_id, "v-1");
  assert.equal(meta.cashless, "true");

  const parsed = parsePaymentMetadata(meta);
  assert.equal(parsed.userId, "u-999");
  assert.deepEqual(parsed.bookingIds, ["b-123", "b-456"]);
  assert.equal(parsed.serviceId, 5);
  assert.equal(parsed.vendedorId, "v-1");
});

test("Stripe: POS params & Checkout session building", () => {
  const posParams = buildPosPaymentIntentParams({
    bookingId: "pos-1",
    userId: "client-1",
    serviceId: 2,
    vendedorId: "vend-1",
    total: 50000,
  });

  assert.equal(posParams.amount, 5_000_000);
  assert.equal(posParams.currency, STRIPE_CURRENCY);
  assert.equal(posParams.metadata.bookingId, "pos-1");

  const now = new Date("2026-10-14T10:00:00Z");
  const checkoutParams = buildCheckoutSessionParams(
    {
      reservaIds: ["res-1"],
      userId: "u-1",
      total: 25000,
      items: [{ reservaId: "res-1", servicioNombre: "Cancha Tenis", cantidadCupos: 1, subtotal: 25000 }],
      now,
    },
    "https://sportcomplex.test",
  );

  assert.equal(checkoutParams.mode, "payment");
  assert.equal(checkoutParams.expires_at, stripeSessionExpiresAtSec(now));
  assert.equal(checkoutParams.metadata?.bookingId, "res-1");
  assert.equal(checkoutParams.metadata?.userId, "u-1");

  assert.equal(extractPaymentIntentId({ payment_intent: "pi_real_123" }), "pi_real_123");
  assert.equal(extractPaymentIntentId({ payment_intent: { id: "pi_nested_456" } as never }), "pi_nested_456");
});

test("Festivos: normalization, cache store and holiday detection", async () => {
  const holiday = normalizeToNagerHoliday({
    date: "2026-12-25",
    localName: "Navidad",
    name: "Christmas",
  });
  assert.equal(holiday.date, "2026-12-25");
  assert.equal(holiday.name, "Christmas");

  const store = new MemoryHolidayCacheStore();
  await store.saveHolidays([holiday], 2026);
  const cached = await store.getByYear(2026);
  assert.equal(cached.length, 1);
  assert.equal(cached[0]?.date, "2026-12-25");

  assert.equal(isDateHoliday("2026-12-25", [holiday]), true);
  assert.equal(isDateHoliday("2026-12-24", [holiday]), false);

  const result = await getColombiaHolidays(2026, {
    cacheStore: store,
    preferCache: true,
  });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.date, "2026-12-25");
});
