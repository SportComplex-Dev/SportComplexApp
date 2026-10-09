import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sendContingencyWebhook } from "../contingency-webhook";

test("TSK-BE-22: el webhook firma el JSON con HMAC SHA-256", async () => {
  const previousUrl = process.env.N8N_CONTINGENCY_WEBHOOK_URL;
  const previousSecret = process.env.N8N_CONTINGENCY_HMAC_SECRET;
  const previousFetch = globalThis.fetch;
  const secret = "test-contingency-secret-at-least-32-chars";
  const payload = { motivo: "prueba", usuarios: [] };
  let sentBody = "";
  let sentSignature = "";

  process.env.N8N_CONTINGENCY_WEBHOOK_URL = "https://n8n.example.test/contingency";
  process.env.N8N_CONTINGENCY_HMAC_SECRET = secret;
  globalThis.fetch = async (_input, init) => {
    sentBody = String(init?.body);
    sentSignature = new Headers(init?.headers).get("X-SportComplex-Signature") ?? "";
    return new Response(null, { status: 204 });
  };

  try {
    const result = await sendContingencyWebhook(payload);
    assert.deepEqual(result, { sent: true });
    assert.equal(sentBody, JSON.stringify(payload));
    assert.equal(
      sentSignature,
      `sha256=${createHmac("sha256", secret).update(sentBody).digest("hex")}`,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.N8N_CONTINGENCY_WEBHOOK_URL;
    else process.env.N8N_CONTINGENCY_WEBHOOK_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.N8N_CONTINGENCY_HMAC_SECRET;
    else process.env.N8N_CONTINGENCY_HMAC_SECRET = previousSecret;
  }
});

test("TSK-BE-22: los errores HTTP y de red no se reportan como despachos exitosos", async () => {
  const previousUrl = process.env.N8N_CONTINGENCY_WEBHOOK_URL;
  const previousSecret = process.env.N8N_CONTINGENCY_HMAC_SECRET;
  const previousFetch = globalThis.fetch;
  process.env.N8N_CONTINGENCY_WEBHOOK_URL = "https://n8n.example.test/contingency";
  process.env.N8N_CONTINGENCY_HMAC_SECRET = "test-contingency-secret-at-least-32-chars";
  globalThis.fetch = async () => new Response(null, { status: 503 });

  try {
    assert.deepEqual(await sendContingencyWebhook({}), {
      sent: false,
      error: "n8n respondió con HTTP 503.",
    });
    globalThis.fetch = async () => {
      throw new Error("network unavailable");
    };
    const networkFailure = await sendContingencyWebhook({});
    assert.equal(networkFailure.sent, false);
    if (!networkFailure.sent) {
      assert.match(networkFailure.error, /network unavailable/);
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.N8N_CONTINGENCY_WEBHOOK_URL;
    else process.env.N8N_CONTINGENCY_WEBHOOK_URL = previousUrl;
    if (previousSecret === undefined) delete process.env.N8N_CONTINGENCY_HMAC_SECRET;
    else process.env.N8N_CONTINGENCY_HMAC_SECRET = previousSecret;
  }
});
