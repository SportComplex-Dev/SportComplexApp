import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-response";
import { expireReservasVencidas } from "@sportcomplex/db";

/**
 * TSK-BD-08 — Cron de expiración TTL 15 min (HU-09 / RF-08 / RN-04).
 * GET para Vercel Cron / pg_net; POST para triggers manuales/admin.
 * Auth: si `CRON_SECRET` está definido, exigir
 * `Authorization: Bearer <secret>` o header `x-cron-secret`.
 * Programar cada minuto (`* * * * *`).
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

async function run() {
  const result = await expireReservasVencidas();
  return ok(result);
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "Cron no autorizado", 401);
  try {
    return await run();
  } catch (err) {
    return fail(
      "EXPIRE_FAILED",
      err instanceof Error ? err.message : "Fallo el job de expiración",
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return fail("UNAUTHORIZED", "Cron no autorizado", 401);
  try {
    return await run();
  } catch (err) {
    return fail(
      "EXPIRE_FAILED",
      err instanceof Error ? err.message : "Fallo el job de expiración",
      500,
    );
  }
}
