import {
  ContingencyError,
  disableServiceForContingency,
  markContingencyWebhookSent,
  prisma,
} from "@sportcomplex/db";
import { disableServiceForContingencySchema } from "@sportcomplex/validation";
import { auth } from "@/auth";
import { fail, ok } from "@/lib/api-response";
import { normalizeRole } from "@/lib/session";
import { sendContingencyWebhook } from "@/lib/contingency-webhook";

interface IncidentSession {
  user?: { id?: string | null } | null;
}

interface IncidentAccount {
  estado: string;
  deletedAt: Date | null;
  rol: { nombre: string } | null;
}

export interface IncidentDependencies {
  authenticate: () => Promise<IncidentSession | null>;
  findAccount: (userId: string) => Promise<IncidentAccount | null>;
  disableService: typeof disableServiceForContingency;
  sendWebhook: typeof sendContingencyWebhook;
  markWebhookSent: typeof markContingencyWebhookSent;
}

const defaultDependencies: IncidentDependencies = {
  authenticate: auth,
  findAccount: (userId) =>
    prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        estado: true,
        deletedAt: true,
        rol: { select: { nombre: true } },
      },
    }),
  disableService: disableServiceForContingency,
  sendWebhook: sendContingencyWebhook,
  markWebhookSent: markContingencyWebhookSent,
};

export async function handleIncidentRequest(
  request: Request,
  dependencies: IncidentDependencies = defaultDependencies,
) {
  try {
    const session = await dependencies.authenticate();
    const userId = session?.user?.id;
    if (!userId) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión.", 401);
    }

    const account = await dependencies.findAccount(userId);
    if (
      !account ||
      account.deletedAt ||
      account.estado !== "ACTIVO" ||
      normalizeRole(account.rol?.nombre) !== "Administrador"
    ) {
      return fail(
        "FORBIDDEN",
        "Solo una cuenta de administrador activa puede gestionar contingencias.",
        403,
      );
    }

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

    const contingency = await dependencies.disableService({
      serviceId: parsed.data.serviceId,
      adminId: userId,
      reason: parsed.data.motivo,
    });
    const webhook = await dependencies.sendWebhook(contingency.webhookPayload);
    let webhookEnviadoRegistrado = false;
    if (webhook.sent) {
      try {
        await dependencies.markWebhookSent(contingency.inhabilitacion.id);
        webhookEnviadoRegistrado = true;
      } catch (error: unknown) {
        console.error(
          "La contingencia quedó aplicada y n8n respondió correctamente, pero no se pudo registrar el despacho:",
          error,
        );
      }
    } else {
      console.error(
        "La contingencia quedó aplicada, pero falló el despacho a n8n:",
        webhook.error,
      );
    }

    return ok({
      servicio: contingency.servicio,
      inhabilitacion: contingency.inhabilitacion,
      reservasCanceladas: contingency.reservasCanceladas,
      webhook,
      webhookEnviadoRegistrado,
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

export async function POST(request: Request) {
  return handleIncidentRequest(request);
}
