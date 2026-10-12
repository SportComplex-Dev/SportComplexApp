import { authorizeApiRequest } from "@/lib/api-auth";
import { AccessError, procesarEscaneo } from "@/lib/access";
import { accessRedeemSchema } from "@sportcomplex/validation";
import { TicketError } from "@sportcomplex/db";
import { fail, ok } from "@/lib/api-response";

type SessionLike = { user?: { id?: string | null; role?: string | null } | null } | null;

/**
 * TSK-BE-14 (HU-14 / RF-13): Endpoint de canje en modo turno.
 *
 * `POST /api/access/redeem`:
 * 1. Valida permisos: Administrador o Empleado_Lector.
 * 2. Valida payload con `accessRedeemSchema` (ticketId UUID, firma HMAC-SHA256, postServiceId entero obligatorio).
 * 3. Valida firma HMAC antes de tocar la base de datos.
 * 4. Ejecuta el canje atómico transmutando el boleto de EMITIDO a USADO.
 * 5. Registra la auditoría en LECTURA_ACCESO con modo = TURNO.
 * 6. Devuelve los datos del boleto para mostrar en pantalla.
 *
 * Criterio Clave:
 * Tras "Dar Acceso", el boleto pasa a USADO con timestamp e ID del empleado lector.
 * Un segundo escaneo del mismo QR se deniega (ALREADY_USED / DENEGADO_USADO)
 * sin re-escribir el boleto y registrando la correspondiente fila de auditoría.
 */
export type AccessRedeemAuthenticate = () => Promise<SessionLike>;

export interface AccessRedeemOptions {
  authenticate?: AccessRedeemAuthenticate;
  now?: Date;
}

export async function handleAccessRedeem(
  request: Request,
  options: AccessRedeemOptions | AccessRedeemAuthenticate = {},
) {
  const qrSecret = process.env.QR_HMAC_SECRET;
  if (!qrSecret) {
    return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
  }

  const opts: AccessRedeemOptions =
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
    const parsed = accessRedeemSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de canje inválidos.", 400, parsed.error.flatten());
    }

    const resultado = await procesarEscaneo(parsed.data, {
      empleadoId: authorization.actor.id,
      qrSecret,
      now: opts.now,
    });
    if (resultado.code === "SERVICE_MISMATCH") {
      return fail(
        resultado.code,
        resultado.message ?? "Acceso denegado por discrepancia de servicio.",
        403,
      );
    }
    return ok(resultado);
  } catch (error: unknown) {
    if (error instanceof AccessError || error instanceof TicketError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/access/redeem:", error);
    return fail("SERVER_ERROR", "Error al procesar el canje.", 500);
  }
}

export async function POST(request: Request) {
  return handleAccessRedeem(request);
}
