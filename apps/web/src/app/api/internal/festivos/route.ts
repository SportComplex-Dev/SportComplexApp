import { ok, fail } from '@sportcomplex/shared/lib';
import { upsertManyFestivos } from "@sportcomplex/db";
import { FestivosBatchSchema } from "@sportcomplex/validation";

type SaveFestivos = (festivos: { fecha: string; nombre: string; anio: number }[]) => Promise<void>;

/**
 * Ingesta interna de festivos para el workflow de n8n
 * (sincronizacion-festivos-colombia). Reemplaza el nodo Postgres con
 * credencial guardada: n8n llama por HTTP con la key compartida.
 *
 * Auth: header `x-internal-key` o `Authorization: Bearer <key>` contra
 * `INTERNAL_API_KEY`. Fail-closed si la variable no está configurada.
 */
function isAuthorized(request: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  if (request.headers.get("x-internal-key") === expected) return true;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export function createFestivosPostHandler(
  dependencies: { saveFestivos?: SaveFestivos } = {},
) {
  const saveFestivos = dependencies.saveFestivos ?? upsertManyFestivos;

  return async function POST(request: Request) {
    if (!process.env.INTERNAL_API_KEY) {
      return fail(
        "INTERNAL_API_NOT_CONFIGURED",
        "La ingesta interna no está configurada.",
        503,
      );
    }
    if (!isAuthorized(request)) {
      return fail("UNAUTHORIZED", "Credencial interna inválida.", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = FestivosBatchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Lote de festivos inválido.",
        400,
        parsed.error.flatten(),
      );
    }

    try {
      await saveFestivos(parsed.data.festivos);
      return ok({ saved: parsed.data.festivos.length });
    } catch (error: unknown) {
      console.error("Error al guardar festivos desde n8n:", error);
      return fail("FESTIVOS_SAVE_FAILED", "No se pudieron guardar los festivos.", 500);
    }
  };
}

export const POST = createFestivosPostHandler();
