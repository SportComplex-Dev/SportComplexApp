import {
  ContingencyError,
  disableServiceForContingency,
  markContingencyWebhookSent,
} from "@sportcomplex/db";
import { disableServiceForContingencySchema } from "@sportcomplex/validation";
import { getAuthorizedApiUser } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";
import { sendContingencyWebhook } from "@/lib/contingency-webhook";

export async function POST(request: Request) {
  try {
    const authorization = await getAuthorizedApiUser(["Administrador"]);
    if (authorization instanceof Response) return authorization;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }
    const parsed = disableServiceForContingencySchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Se requiere un servicio y un motivo de contingencia válido.",
        400,
        parsed.error.flatten(),
      );
    }

    const contingency = await disableServiceForContingency({
      serviceId: parsed.data.serviceId,
      adminId: authorization.userId,
      reason: parsed.data.motivo,
    });
    const webhook = await sendContingencyWebhook(contingency.webhookPayload);
    if (webhook.sent) {
      await markContingencyWebhookSent(contingency.inhabilitacion.id);
    } else {
      console.error("La contingencia quedó aplicada, pero falló el despacho a n8n:", webhook.error);
    }

    return ok({
      servicio: contingency.servicio,
      inhabilitacion: contingency.inhabilitacion,
      reservasCanceladas: contingency.reservasCanceladas,
      webhook,
      reembolsoAutomatico: false,
    });
  } catch (error: unknown) {
    if (error instanceof ContingencyError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/admin/incident:", error);
    return fail(
      "SERVER_ERROR",
      "No fue posible procesar la inhabilitación por contingencia.",
      500,
    );
  }
}
