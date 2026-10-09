import { timingSafeEqual } from "node:crypto";
import { fail } from "@/lib/api-response";

export function authorizeBotApiKey(request: Request): Response | null {
  const expectedKey = process.env.BOT_API_KEY;
  if (!expectedKey) {
    return fail("BOT_API_KEY_NOT_CONFIGURED", "La API del chatbot no está configurada.", 503);
  }

  const providedKey = request.headers.get("x-api-key");
  if (!providedKey) {
    return fail("UNAUTHORIZED", "Falta una API key válida.", 401);
  }

  const expected = Buffer.from(expectedKey);
  const provided = Buffer.from(providedKey);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return fail("UNAUTHORIZED", "Falta una API key válida.", 401);
  }

  return null;
}
