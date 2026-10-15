import { ACCESS_SERVICE_MISMATCH_MESSAGE } from "@sportcomplex/core";
import { fail, ok } from '@sportcomplex/shared/lib';
import type { EscaneoResultado } from "@/lib/access";

/** Respuesta HTTP compartida para los endpoints de escaneo y canje. */
export function accessResultResponse(resultado: EscaneoResultado) {
  if (resultado.code === "SERVICE_MISMATCH") {
    return fail(
      resultado.code,
      resultado.message ?? ACCESS_SERVICE_MISMATCH_MESSAGE,
      403,
    );
  }
  return ok(resultado);
}
