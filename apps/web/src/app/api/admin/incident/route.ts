import {
  ContingencyError,
  disableServiceForContingency,
  getContingencyPreview,
  markContingencyWebhookSent,
  prisma,
} from "@sportcomplex/db";
import { disableServiceForContingencySchema } from "@sportcomplex/validation";
import { auth } from "@/lib/auth/auth";
import { fail, ok } from '@sportcomplex/shared/lib';
import { authorizeApiRequest } from "@/lib/api/api-auth";
import { sendContingencyWebhook } from '@sportcomplex/shared/lib';

interface IncidentSession {
  user?: { id?: string | null } | null;
}

export interface IncidentAccount {
  id?: string;
  estado: string;
  deletedAt: Date | null;
  rol: { nombre: string } | null;
}

export interface IncidentDependencies {
  authenticate: () => Promise<IncidentSession | null>;
  findAccount: (identifier: string) => Promise<IncidentAccount | null>;
  disableService: typeof disableServiceForContingency;
  previewContingency: typeof getContingencyPreview;
  sendWebhook: typeof sendContingencyWebhook;
  markWebhookSent: typeof markContingencyWebhookSent;
}

const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultDependencies: IncidentDependencies = {
  authenticate: auth,
  findAccount: (identifier) => {
    const isEmail = identifier.includes("@");
    const validUuid = isUuid.test(identifier);
    if (!isEmail && !validUuid) return Promise.resolve(null);

    return prisma.usuario.findFirst({
      where: validUuid
        ? { id: identifier }
        : { correo: identifier.toLowerCase() },
      select: {
        id: true,
        estado: true,
        deletedAt: true,
        rol: { select: { nombre: true } },
      },
    });
  },
  disableService: disableServiceForContingency,
  previewContingency: getContingencyPreview,
  sendWebhook: sendContingencyWebhook,
  markWebhookSent: markContingencyWebhookSent,
};

export async function handleIncidentPreviewRequest(
  request: Request,
  dependencies: IncidentDependencies = defaultDependencies,
) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"], {
      authenticate: dependencies.authenticate,
      db: {
        usuario: {
          findUnique: async (args) => {
            const identifier =
              "id" in args.where
                ? args.where.id
                : "correo" in args.where
                  ? args.where.correo
                  : undefined;
            if (!identifier) return null;
            const user = await dependencies.findAccount(identifier);
            if (!user) return null;
            return {
              id: user.id ?? identifier,
              estado: user.estado,
              deletedAt: user.deletedAt,
              rol: user.rol,
            };
          },
        },
      },
    });
    if (!authorization.authorized) return authorization.response;

    const { searchParams } = new URL(request.url);
    const serviceIdRaw = searchParams.get("serviceId");
    if (!serviceIdRaw) {
      return fail("MISSING_SERVICE_ID", "El parámetro serviceId es requerido.", 400);
    }

    const serviceId = parseInt(serviceIdRaw, 10);
    if (isNaN(serviceId) || serviceId <= 0) {
      return fail("INVALID_SERVICE_ID", "El ID del servicio debe ser un número entero positivo.", 400);
    }

    const preview = await dependencies.previewContingency(serviceId);
    return ok(preview);
  } catch (error: unknown) {
    if (error instanceof ContingencyError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en GET /api/admin/incident:", error);
    return fail(
      "SERVER_ERROR",
      "No fue posible consultar el resumen previo de contingencia.",
      500,
    );
  }
}

export async function handleIncidentRequest(
  request: Request,
  dependencies: IncidentDependencies = defaultDependencies,
) {
  try {
    const authorization = await authorizeApiRequest(["Administrador"], {
      authenticate: dependencies.authenticate,
      db: {
        usuario: {
          findUnique: async (args) => {
            const identifier =
              "id" in args.where
                ? args.where.id
                : "correo" in args.where
                  ? args.where.correo
                  : undefined;
            if (!identifier) return null;
            const user = await dependencies.findAccount(identifier);
            if (!user) return null;
            return {
              id: user.id ?? identifier,
              estado: user.estado,
              deletedAt: user.deletedAt,
              rol: user.rol,
            };
          },
        },
      },
    });
    if (!authorization.authorized) return authorization.response;
    const userId = authorization.actor.id;

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

export async function GET(request: Request) {
  return handleIncidentPreviewRequest(request);
}

export async function POST(request: Request) {
  return handleIncidentRequest(request);
}

