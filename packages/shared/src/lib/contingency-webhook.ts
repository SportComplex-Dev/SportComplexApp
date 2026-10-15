import { createHmac } from "node:crypto";

export type ContingencyWebhookResult =
  | { sent: true }
  | { sent: false; error: string };

export async function sendContingencyWebhook(
  payload: unknown,
): Promise<ContingencyWebhookResult> {
  const url = process.env.N8N_CONTINGENCY_WEBHOOK_URL;
  const secret = process.env.N8N_CONTINGENCY_HMAC_SECRET;
  if (!url) {
    return { sent: false, error: "N8N_CONTINGENCY_WEBHOOK_URL no está configurada." };
  }
  if (!secret) {
    return { sent: false, error: "N8N_CONTINGENCY_HMAC_SECRET no está configurada." };
  }
  if (secret.length < 32) {
    return {
      sent: false,
      error: "N8N_CONTINGENCY_HMAC_SECRET debe tener al menos 32 caracteres.",
    };
  }

  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SportComplex-Signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) {
      return {
        sent: false,
        error: `n8n respondió con HTTP ${response.status}.`,
      };
    }
    return { sent: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error de red no identificado.";
    return { sent: false, error: `No se pudo contactar n8n: ${message}` };
  }
}
