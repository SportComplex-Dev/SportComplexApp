import { fail } from "@/lib/api-response";

// RF-19/RF-20 — n8n no bloqueante (RN-12), chatbot
export async function POST() {
  return fail("NOT_IMPLEMENTED", "Webhooks n8n pendientes (feature/contingency-n8n-webhook)", 501);
}
