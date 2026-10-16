import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  sendReservationQrWebhook,
  type ReservationQrWebhookPayload,
} from "./reservation-qr-webhook";

const dummyPayload: ReservationQrWebhookPayload = {
  reservaId: "res-uuid-1",
  ticketId: "ticket-uuid-1",
  correo: "usuario@ejemplo.com",
  nombre: "Juan Pérez",
  cancha: "Cancha de Tenis 1",
  sede: "AKROS Club",
  fecha: "2026-10-25",
  franjaHoraria: "10:00 - 11:00",
  qrPayload: "SC1:ticket-uuid-1:signature-test",
  qrImageUrl: "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=test",
  appUrl: "https://akros.lat",
};

test("TSK-BE-34: sendReservationQrWebhook envía el payload a n8n sin HMAC cuando no hay secreto", async () => {
  const prevUrl = process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  const prevSecret = process.env.N8N_RESERVATION_QR_HMAC_SECRET;
  const prevFetch = globalThis.fetch;

  let capturedBody = "";
  let capturedHeaders: Headers | null = null;

  process.env.N8N_RESERVATION_QR_WEBHOOK_URL = "https://n8n.example.com/webhook/reservas/despacho-qr";
  delete process.env.N8N_RESERVATION_QR_HMAC_SECRET;

  globalThis.fetch = async (_input, init) => {
    capturedBody = String(init?.body);
    capturedHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await sendReservationQrWebhook(dummyPayload);
    assert.deepEqual(result, { sent: true });
    assert.equal(capturedBody, JSON.stringify(dummyPayload));
    assert.equal(capturedHeaders?.get("Content-Type"), "application/json");
    assert.equal(capturedHeaders?.has("X-SportComplex-Signature"), false);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl !== undefined) process.env.N8N_RESERVATION_QR_WEBHOOK_URL = prevUrl;
    else delete process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
    if (prevSecret !== undefined) process.env.N8N_RESERVATION_QR_HMAC_SECRET = prevSecret;
    else delete process.env.N8N_RESERVATION_QR_HMAC_SECRET;
  }
});

test("TSK-BE-34: sendReservationQrWebhook incluye firma HMAC cuando N8N_RESERVATION_QR_HMAC_SECRET está configurada", async () => {
  const prevUrl = process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  const prevSecret = process.env.N8N_RESERVATION_QR_HMAC_SECRET;
  const prevFetch = globalThis.fetch;

  const secret = "secret-key-at-least-32-characters-long!";
  let capturedSignature = "";

  process.env.N8N_RESERVATION_QR_WEBHOOK_URL = "https://n8n.example.com/webhook/reservas/despacho-qr";
  process.env.N8N_RESERVATION_QR_HMAC_SECRET = secret;

  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    capturedSignature = headers.get("X-SportComplex-Signature") ?? "";
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  try {
    const result = await sendReservationQrWebhook(dummyPayload);
    assert.deepEqual(result, { sent: true });
    const expectedSignature = `sha256=${createHmac("sha256", secret).update(JSON.stringify(dummyPayload)).digest("hex")}`;
    assert.equal(capturedSignature, expectedSignature);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl !== undefined) process.env.N8N_RESERVATION_QR_WEBHOOK_URL = prevUrl;
    else delete process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
    if (prevSecret !== undefined) process.env.N8N_RESERVATION_QR_HMAC_SECRET = prevSecret;
    else delete process.env.N8N_RESERVATION_QR_HMAC_SECRET;
  }
});

test("TSK-BE-34: sendReservationQrWebhook maneja URL ausente sin lanzar excepciones", async () => {
  const prevUrl = process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  delete process.env.N8N_RESERVATION_QR_WEBHOOK_URL;

  try {
    const result = await sendReservationQrWebhook(dummyPayload);
    assert.equal(result.sent, false);
    if (!result.sent) {
      assert.match(result.error, /N8N_RESERVATION_QR_WEBHOOK_URL no está configurada/);
    }
  } finally {
    if (prevUrl !== undefined) process.env.N8N_RESERVATION_QR_WEBHOOK_URL = prevUrl;
    else delete process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  }
});

test("TSK-BE-34: sendReservationQrWebhook captura errores HTTP y caídas de red de forma segura", async () => {
  const prevUrl = process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  const prevFetch = globalThis.fetch;

  process.env.N8N_RESERVATION_QR_WEBHOOK_URL = "https://n8n.example.com/webhook/reservas/despacho-qr";

  globalThis.fetch = async () => new Response("Internal Server Error", { status: 500 });

  try {
    const resultHttpErr = await sendReservationQrWebhook(dummyPayload);
    assert.equal(resultHttpErr.sent, false);
    if (!resultHttpErr.sent) {
      assert.match(resultHttpErr.error, /HTTP 500/);
    }

    globalThis.fetch = async () => {
      throw new Error("Connection timeout");
    };

    const resultNetErr = await sendReservationQrWebhook(dummyPayload);
    assert.equal(resultNetErr.sent, false);
    if (!resultNetErr.sent) {
      assert.match(resultNetErr.error, /Connection timeout/);
    }
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl !== undefined) process.env.N8N_RESERVATION_QR_WEBHOOK_URL = prevUrl;
    else delete process.env.N8N_RESERVATION_QR_WEBHOOK_URL;
  }
});
