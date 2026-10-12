import { authorizeApiRequest } from "@/lib/api-auth";
import { AccessError, procesarEscaneo } from "@/lib/access";
import { accessScanSchema } from "@sportcomplex/validation";
import { TicketError } from "@sportcomplex/db";
import { fail, ok } from "@/lib/api-response";

// RF-13 / RF-14 / RF-15 — canje de ticket + auditoría (TSK-BD-10).
// Firma HMAC → decideAccess → transacción única (UPDATE WHERE estado='EMITIDO'
// + INSERT en LECTURA_ACCESO). Siempre escribe 1 fila de auditoría por lectura;
type SessionLike = { user?: { id?: string | null; role?: string | null } | null } | null;
export type AccessAuthenticate = () => Promise<SessionLike>;

export interface AccessOptions {
  authenticate?: AccessAuthenticate;
  now?: Date;
}

export async function handleAccess(
  request: Request,
  options: AccessOptions | AccessAuthenticate = {},
) {
  const qrSecret = process.env.QR_HMAC_SECRET;
  if (!qrSecret) {
    return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
  }

  const opts: AccessOptions =
    typeof options === "function" ? { authenticate: options } : options;

  try {
    const authorization = await authorizeApiRequest(
      ["Administrador", "Empleado_Lector"],
      opts.authenticate ? { authenticate: opts.authenticate } : {},
    );
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }
    const parsed = accessScanSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Escaneo inválido.", 400, parsed.error.flatten());
    }

    const resultado = await procesarEscaneo(parsed.data, {
      empleadoId: authorization.actor.id,
      qrSecret,
      now: opts.now,
    });
    return ok(resultado);
  } catch (error: unknown) {
    if (error instanceof AccessError || error instanceof TicketError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/access:", error);
    return fail("SERVER_ERROR", "Error al procesar el escaneo.", 500);
  }
}

export async function POST(request: Request) {
  return handleAccess(request);
}

