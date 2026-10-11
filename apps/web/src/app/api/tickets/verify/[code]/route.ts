import { AccessError, procesarEscaneo } from "@/lib/access";
import { fail, ok } from "@/lib/api-response";
import { TicketError } from "@sportcomplex/db";
import { accessScanSchema } from "@sportcomplex/validation";
import { authorizeApiRequest } from "@/lib/api-auth";

interface RouteContext {
  params: Promise<{ code: string }>;
}

type TicketVerifySession = { user?: { id?: string | null } | null } | null;

export async function handleTicketVerification(
  request: Request,
  context: RouteContext,
  authenticate?: () => Promise<TicketVerifySession>,
) {
  const qrSecret = process.env.QR_HMAC_SECRET;
  if (!qrSecret) {
    return fail("QR_NOT_CONFIGURED", "Falta QR_HMAC_SECRET.", 503);
  }

  try {
    const authorization = await authorizeApiRequest(
      ["Administrador", "Empleado_Lector"],
      authenticate ? { authenticate } : {},
    );
    if (!authorization.authorized) return authorization.response;

    const signature = request.headers.get("x-ticket-signature");
    if (!signature) {
      return fail("MISSING_SIGNATURE", "Falta el header x-ticket-signature.", 400);
    }

    const { code } = await context.params;
    const parsed = accessScanSchema.safeParse({
      ticketId: code,
      signature,
      postServiceId: null,
    });
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Código o firma del ticket inválidos.", 400);
    }

    const resultado = await procesarEscaneo(parsed.data, {
      empleadoId: authorization.actor.id,
      qrSecret,
    });
    return ok(resultado);
  } catch (error: unknown) {
    if (error instanceof AccessError || error instanceof TicketError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/tickets/verify/[code]:", error);
    return fail("SERVER_ERROR", "Error al consultar el ticket.", 500);
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handleTicketVerification(request, context);
}
