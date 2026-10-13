import ky from "ky";

// Disparo n8n no bloqueante — fallos no revierten DB (RN-12, ARCHITECTURE §9.4)
export async function fireContingencyWebhook(payload: unknown): Promise<void> {
  const url = process.env.N8N_CONTINGENCY_WEBHOOK_URL;
  if (!url) return;
  try {
    await ky.post(url, { json: payload, timeout: 2500, retry: 0 });
  } catch {
    // fire-and-forget: se registra en logs, no se revierte la cancelación
    console.warn("[n8n] contingency webhook failed (non-blocking)");
  }
}
