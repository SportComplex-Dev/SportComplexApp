import { fail, ok } from '@sportcomplex/shared/lib';
import { authorizeApiRequest } from "@/lib/api-auth";
import { tournamentQuerySchema } from "@sportcomplex/validation";
import {
  listarTorneos,
  obtenerInscripcionesUsuarioParaTorneos,
} from "@sportcomplex/db";
import { signTicket, buildTicketQrPayload } from "@sportcomplex/core";

/**
 * GET /api/tournaments
 * Catálogo público/cliente de torneos deportivos con cálculo en tiempo real
 * de cupos disponibles y estado de inscripción para el usuario autenticado (RF-15 / RNF-01).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queryObj: Record<string, string | undefined> = {
      estado: searchParams.get("estado") || undefined,
      categoriaId: searchParams.get("categoriaId") || undefined,
      search: searchParams.get("search") || undefined,
      soloActivos: searchParams.get("soloActivos") !== null ? searchParams.get("soloActivos")! : undefined,
      page: searchParams.get("page") || undefined,
      limit: searchParams.get("limit") || undefined,
    };

    const parsed = tournamentQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return fail(
        "VALIDATION_ERROR",
        "Parámetros de consulta inválidos",
        400,
        parsed.error.flatten(),
      );
    }

    const ESTADOS_CATALOGO_PUBLICO = ["INSCRIPCIONES_ABIERTAS", "EN_CURSO", "FINALIZADO"];
    if (parsed.data.estado && !ESTADOS_CATALOGO_PUBLICO.includes(parsed.data.estado)) {
      return fail(
        "INVALID_FILTER",
        "Estado de torneo no disponible para consulta pública.",
        400,
      );
    }

    // Por defecto en el catálogo público, si no se especifica estado o soloActivos,
    // filtramos solo torneos activos (INSCRIPCIONES_ABIERTAS o EN_CURSO)
    const filtros = {
      ...parsed.data,
      soloActivos: parsed.data.estado ? undefined : (parsed.data.soloActivos ?? true),
    };

    const torneos = await listarTorneos(filtros);

    // Consulta opcional de sesión para indicar al usuario si ya está inscrito
    const authResult = await authorizeApiRequest([
      "Cliente",
      "Administrador",
    ]).catch(() => null);

    interface TorneoItem {
      id: string;
      cuposTotales: number;
      cuposOcupados: number;
      estado: string;
      [key: string]: unknown;
    }

    interface MiInscripcionItem {
      id: string;
      estado: string;
      nombrePareja: string | null;
      ticketCodigoUuid: string | null;
      ticketEstado?: string;
      /** INT-01: payload QR firmado SC1:<uuid>:<hmac> — solo para inscripciones CONFIRMADAS con ticket emitido */
      ticketQrPayload: string | null;
    }

    const inscripcionesMap = new Map<string, MiInscripcionItem>();
    if (authResult && authResult.authorized) {
      const torneoIds = (torneos as TorneoItem[]).map((t: TorneoItem) => t.id);
      const misInscripciones = await obtenerInscripcionesUsuarioParaTorneos(
        authResult.actor.id,
        torneoIds,
      );
      const qrSecret = process.env.QR_HMAC_SECRET;
      for (const ins of misInscripciones as Array<{
        id: string;
        torneoId: string;
        estado: string;
        nombrePareja?: string | null;
        ticketCodigoUuid?: string | null;
        ticketEstado?: string;
      }>) {
        // INT-01: Generar payload firmado SC1 solo para inscripciones CONFIRMADAS con ticket emitido.
        // Usamos las bibliotecas de @sportcomplex/core que ya maneja este contrato en todo el monorepo.
        let ticketQrPayload: string | null = null;
        if (
          ins.estado === "CONFIRMADA" &&
          ins.ticketCodigoUuid &&
          qrSecret
        ) {
          try {
            const signature = signTicket(ins.ticketCodigoUuid, qrSecret);
            ticketQrPayload = buildTicketQrPayload(ins.ticketCodigoUuid, signature);
          } catch {
            // Si falla la firma (UUID mal formado), no exponer payload
            ticketQrPayload = null;
          }
        }
        inscripcionesMap.set(ins.torneoId, {
          id: ins.id,
          estado: ins.estado,
          nombrePareja: ins.nombrePareja ?? null,
          ticketCodigoUuid: ins.ticketCodigoUuid ?? null,
          ticketEstado: ins.ticketEstado,
          ticketQrPayload,
        });
      }
    }

    const resultado = (torneos as TorneoItem[]).map((t: TorneoItem) => {
      const cuposDisponibles = Math.max(0, t.cuposTotales - t.cuposOcupados);
      const inscripcionesAbiertas =
        t.estado === "INSCRIPCIONES_ABIERTAS" && cuposDisponibles > 0;
      const miInscripcion = inscripcionesMap.get(t.id) ?? null;

      return {
        ...t,
        cuposDisponibles,
        inscripcionesAbiertas,
        yaInscrito: Boolean(miInscripcion),
        miInscripcion,
      };
    });

    return ok(resultado);
  } catch (error: unknown) {
    console.error("Error en GET /api/tournaments:", error);
    return fail("SERVER_ERROR", "Error al consultar los torneos disponibles", 500);
  }
}
