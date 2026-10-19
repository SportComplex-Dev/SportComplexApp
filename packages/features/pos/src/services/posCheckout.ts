import { posCheckoutSchema } from "@sportcomplex/validation";
import {
  applyMembershipDiscount,
  createPosPaymentIntent,
  createStripeCheckoutSession,
  STRIPE_MIN_AMOUNT_COP,
} from "@sportcomplex/core";
import type {
  PosAuthorizationResult,
  PosCheckoutHandlerDependencies,
  PosDatabaseClient,
  PosDisponibilidadRecord,
  TxResult,
} from "../types/pos";

function jsonSafe(data: unknown): unknown {
  if (typeof data === "bigint") return data.toString();
  if (data === null || typeof data !== "object") return data;
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(jsonSafe);
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    copy[key] = jsonSafe(value);
  }
  return copy;
}

function defaultOk(data: unknown, status = 200): Response {
  return Response.json(
    { success: true, data: jsonSafe(data) },
    { status },
  );
}

function defaultFail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): Response {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details: jsonSafe(details) } : {}),
      },
    },
    { status },
  );
}

async function resolveDb(injected?: PosDatabaseClient | unknown): Promise<PosDatabaseClient> {
  if (injected) return injected as PosDatabaseClient;
  const dbModule = await import("@sportcomplex/db");
  return dbModule.prisma as unknown as PosDatabaseClient;
}

type PosAuthSession = {
  user?: { id?: string | null; email?: string | null; role?: string | null } | null;
};

let authenticateOverride: (() => Promise<PosAuthSession | null>) | undefined;

/**
 * Composición: sustituye el proveedor de sesión cuando el handler se ejecuta
 * fuera de NextAuth. No lee variables de entorno ni conoce a los tests.
 */
export function configurePosAuthorization(
  authenticate: (() => Promise<PosAuthSession | null>) | undefined,
): void {
  authenticateOverride = authenticate;
}

async function defaultAuthorize(
  allowedRoles: readonly string[],
  db: PosDatabaseClient,
  failFn: typeof defaultFail,
): Promise<PosAuthorizationResult> {
  const session = authenticateOverride ? await authenticateOverride() : undefined;

  const userId = session?.user?.id;
  if (!userId) {
    return {
      authorized: false,
      response: failFn("UNAUTHORIZED", "Debes iniciar sesión.", 401),
    };
  }

  const account = (await db.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      estado: true,
      deletedAt: true,
      rol: { select: { nombre: true } },
    },
  })) ?? (
    session?.user?.email
      ? await db.usuario.findUnique({
          where: { correo: session.user.email },
          select: {
            id: true,
            estado: true,
            deletedAt: true,
            rol: { select: { nombre: true } },
          },
        })
      : null
  );

  if (!account || account.deletedAt || account.estado !== "ACTIVO") {
    return {
      authorized: false,
      response: failFn("FORBIDDEN", "La cuenta no está activa.", 403),
    };
  }

  const rawRole = (account.rol?.nombre || session?.user?.role || "").trim().toUpperCase();
  let role: string | null = null;
  if (rawRole === "ADMIN" || rawRole === "ADMINISTRADOR") {
    role = "Administrador";
  } else if (
    rawRole === "VENDEDOR" ||
    rawRole === "EMPLEADO_VENDEDOR" ||
    rawRole === "EMPLEADO VENDEDOR"
  ) {
    role = "Empleado_Vendedor";
  } else if (
    rawRole === "LECTOR" ||
    rawRole === "EMPLEADO_LECTOR" ||
    rawRole === "EMPLEADO LECTOR"
  ) {
    role = "Empleado_Lector";
  } else if (rawRole === "CLIENTE") {
    role = "Cliente";
  }

  if (!role || !allowedRoles.includes(role)) {
    return {
      authorized: false,
      response: failFn("FORBIDDEN", "No tienes permisos para esta operación.", 403),
    };
  }

  return { authorized: true, actor: { id: account.id, role } };
}

export function createPosCheckoutPostHandler(
  dependencies: PosCheckoutHandlerDependencies = {},
) {
  const authorize = dependencies.authorize;
  const createPaymentIntent = dependencies.createPaymentIntent ?? createPosPaymentIntent;
  const createCheckoutSession = dependencies.createCheckoutSession ?? createStripeCheckoutSession;
  const ok = dependencies.ok ?? defaultOk;
  const fail = dependencies.fail ?? defaultFail;

  return async function POST(request: Request): Promise<Response> {
    try {
      const db = await resolveDb(dependencies.db);

      const authorization: PosAuthorizationResult = authorize
        ? await authorize(["Empleado_Vendedor", "Administrador"])
        : await defaultAuthorize(["Empleado_Vendedor", "Administrador"], db, fail);

      if (!authorization.authorized) return authorization.response;

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
      }

      const parsed = posCheckoutSchema.safeParse(body);
      if (!parsed.success) {
        return fail("VALIDATION_ERROR", "Datos de venta POS inválidos.", 400, parsed.error.flatten());
      }

      const input = parsed.data;
      const sellerId = authorization.actor.id;

      // Restricción 100% Cashless (RN-13 / RF-17): solo se admite tarjeta Stripe o enlace alternativo
      if (input.paymentMode !== "stripe_card" && input.paymentMode !== "stripe_link") {
        return fail(
          "VALIDATION_ERROR",
          "El punto de venta es 100% cashless. Solo se aceptan pagos electrónicos con Stripe.",
          400,
        );
      }

      // 1. Obtener o registrar cliente de taquilla
      let cliente = await db.usuario.findFirst({
        where: { correo: input.clienteEmail },
      });

      if (!cliente) {
        const rolCliente = await db.rol.findFirst({
          where: { nombre: { in: ["CLIENTE", "Cliente"] } },
        });
        if (!rolCliente) {
          return fail(
            "ROLE_NOT_CONFIGURED",
            "Rol CLIENTE inexistente en BD: ejecute el seed antes de vender en POS.",
            500,
          );
        }
        cliente = await db.usuario.create({
          data: {
            correo: input.clienteEmail,
            nombre: input.clienteNombre,
            passwordHash: "$2b$10$pos_dummy_hash_for_cashless_walk_in",
            estado: "ACTIVO",
            rolId: rolCliente.id,
          },
        });
      }

      // 2. Validación de membresía real en servidor (RN-08 / SEC-03)
      // Nunca confiar en `input.esSocio`: consultar membresía VIGENTE en la BD.
      const membresiaVigente = await db.membresia.findFirst({
        where: {
          usuarioId: cliente.id,
          estado: "VIGENTE",
        },
      });
      const esSocioReal = Boolean(membresiaVigente);
      const descuentoPct = esSocioReal ? 30 : 0;

      // 3. Ejecutar transacción atómica con validación de capacidad y franja horaria (PERF-01 / PERF-02)
      const targetDate = new Date(`${input.date}T00:00:00.000Z`);

      const txResult: TxResult = await db.$transaction(async (tx) => {
        const servicio = await tx.servicio.findUnique({
          where: { id: input.serviceId },
          include: { categoria: true },
        });

        if (!servicio || servicio.estado !== "ACTIVO") {
          return {
            ok: false,
            response: fail("SERVICE_UNAVAILABLE", "El servicio solicitado no está disponible.", 404),
          };
        }

        // Cálculo financiero: antes de tocar franja, cupos o reserva, para no
        // dejar un hold colgado si Stripe no puede cobrar el monto.
        const tarifaUnit = Number(servicio.tarifa);
        const subtotalBruto = tarifaUnit * input.cantidadCupos;
        const totalCents = applyMembershipDiscount(subtotalBruto * 100, esSocioReal);
        const totalFinal = Math.round(totalCents / 100);
        const subtotal = Math.round(totalFinal / 1.19);
        const iva = totalFinal - subtotal;
        const descuentoMonto = subtotalBruto - totalFinal;

        if (totalFinal < STRIPE_MIN_AMOUNT_COP) {
          return {
            ok: false,
            response: fail(
              "AMOUNT_BELOW_MINIMUM",
              `El monto mínimo para cobrar con tarjeta es $${STRIPE_MIN_AMOUNT_COP.toLocaleString("es-CO")}.`,
              422,
            ),
          };
        }

        // Resolver la franja horaria y disponibilidad específica (PERF-02)
        let disponibilidad: PosDisponibilidadRecord | null = null;

        if (input.disponibilidadId) {
          disponibilidad = await tx.disponibilidad.findUnique({
            where: { id: BigInt(input.disponibilidadId) },
            include: { franja: true },
          });
        }

        if (!disponibilidad) {
          const candidates = await tx.disponibilidad.findMany({
            where: {
              servicioId: input.serviceId,
              fecha: targetDate,
            },
            include: { franja: true },
          });

          // Buscar coincidencia horaria entre franjas existentes y slotTime
          if (candidates.length > 0) {
            const slotLower = input.slotTime.toLowerCase();
            disponibilidad =
              candidates.find((c) => {
                if (!c.franja) return false;
                const hour = c.franja.horaInicio.getUTCHours();
                return (
                  slotLower.includes(String(hour).padStart(2, "0")) ||
                  slotLower.includes(String(hour))
                );
              }) ||
              candidates[0] ||
              null;
          }
        }

        if (!disponibilidad) {
          // Crear franja horaria para el día de la semana si no existía
          const diaSemana = targetDate.getUTCDay() || 7;
          let franja = await tx.franjaHoraria.findFirst({
            where: { servicioId: input.serviceId, diaSemana },
          });
          if (!franja) {
            franja = await tx.franjaHoraria.create({
              data: {
                servicioId: input.serviceId,
                diaSemana,
                horaInicio: new Date("1899-12-31T08:00:00.000Z"),
                horaFin: new Date("1899-12-31T09:00:00.000Z"),
              },
            });
          }

          disponibilidad = await tx.disponibilidad.create({
            data: {
              servicioId: input.serviceId,
              franjaId: franja.id,
              fecha: targetDate,
              cuposTotales: servicio.capacidadMaxima || 10,
              cuposOcupados: 0,
              bloqueadaMantenimiento: false,
            },
            include: { franja: true },
          });
        }

        // Validar mantenimiento (PERF-01)
        if (disponibilidad.bloqueadaMantenimiento) {
          return {
            ok: false,
            response: fail("SLOT_BLOCKED", "La franja horaria está bloqueada por mantenimiento.", 409),
          };
        }

        // Validar cupos y aforo disponible atómicamente (PERF-01)
        const cuposTotales = disponibilidad.cuposTotales || 10;
        const cuposOcupados = disponibilidad.cuposOcupados || 0;
        if (cuposOcupados + input.cantidadCupos > cuposTotales) {
          return {
            ok: false,
            response: fail(
              "CAPACITY_EXCEEDED",
              "No hay suficientes cupos disponibles en el horario seleccionado.",
              409,
            ),
          };
        }

        if (servicio.modalidad === "EXCLUSIVA" && cuposOcupados > 0) {
          return {
            ok: false,
            response: fail(
              "CAPACITY_EXCEEDED",
              "La franja horaria exclusiva ya se encuentra reservada.",
              409,
            ),
          };
        }

        // Incrementar cupos ocupados de manera atómica
        await tx.disponibilidad.update({
          where: { id: disponibilidad.id },
          data: { cuposOcupados: { increment: input.cantidadCupos } },
        });

        // Crear reserva en estado PENDIENTE_PAGO vinculada a vendedor y canal TAQUILLA
        const reserva = await tx.reserva.create({
          data: {
            disponibilidadId: disponibilidad.id,
            titularId: cliente.id,
            vendedorId: sellerId,
            cantidadCupos: input.cantidadCupos,
            canal: "TAQUILLA",
            estado: "PENDIENTE_PAGO",
            subtotal,
            descuentoPct,
            total: totalFinal,
            expiraEn: new Date(Date.now() + 30 * 60_000),
            membresiaId: (membresiaVigente?.id as number | string | undefined) ?? null,
          },
        });

        return {
          ok: true,
          servicio,
          reserva,
          subtotal,
          iva,
          totalFinal,
          descuentoMonto,
        };
      });

      if (!txResult.ok) {
        return txResult.response;
      }

      const { servicio, reserva, subtotal, iva, totalFinal, descuentoMonto } = txResult;
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      // 4. Modo Enlace Alternativo (Riesgo 2 SRS §11.1 / ARCH-03)
      if (input.paymentMode === "stripe_link") {
        let checkoutSession: { sessionId: string; url: string | null } | undefined;
        try {
          checkoutSession = await createCheckoutSession({
            reservaIds: [reserva.id],
            userId: cliente.id,
            total: totalFinal,
            items: [
              {
                reservaId: reserva.id,
                servicioNombre: servicio.nombre,
                cantidadCupos: input.cantidadCupos,
                subtotal: totalFinal,
              },
            ],
            // El cliente de mostrador paga desde su celular sin sesión: vuelve a
            // una página pública; el ticket lo imprime la taquilla.
            successUrl: `${appUrl}/pago-taquilla?estado=ok`,
            cancelUrl: `${appUrl}/pago-taquilla?estado=cancelado`,
          });
        } catch (err: unknown) {
          if (err instanceof Error && err.message.includes("STRIPE_NOT_CONFIGURED")) {
            // Entorno de test o sin claves Stripe configuradas; usar fallback
          } else {
            console.error("Error creando Checkout Session para enlace alternativo:", err);
          }
        }

        const fallbackUrl = `${appUrl}/checkout?session_id=${checkoutSession?.sessionId || `pos_alt_${reserva.id}`}&reservaId=${reserva.id}&serviceId=${servicio.id}&date=${input.date}&time=${encodeURIComponent(input.slotTime)}&attendees=${input.cantidadCupos}&amount=${totalFinal}`;
        const alternativePaymentUrl = checkoutSession?.url || fallbackUrl;

        return ok({
          success: true,
          booking: {
            id: reserva.id,
            code: `AKR-POS-${reserva.id.slice(0, 8).toUpperCase()}`,
            client: input.clienteNombre,
            document: input.clienteDocumento,
            email: input.clienteEmail,
            service: servicio.nombre,
            date: input.date,
            time: input.slotTime,
            attendees: input.cantidadCupos,
            amount: totalFinal,
            subtotal,
            iva,
            discount: descuentoMonto,
            status: "PENDIENTE_PAGO",
            canal: "TAQUILLA",
            vendedorId: sellerId,
            paymentMode: input.paymentMode,
            stripeCheckoutSessionId: checkoutSession?.sessionId,
            alternativePaymentUrl,
          },
          stripeCheckoutSessionId: checkoutSession?.sessionId,
          alternativePaymentUrl,
        });
      }

      // 5. Cobro presencial con tarjeta Stripe (SEC-02 / ARCH-01)
      let paymentIntent;
      try {
        paymentIntent = await createPaymentIntent(
          {
            bookingId: reserva.id,
            userId: cliente.id,
            serviceId: servicio.id,
            vendedorId: sellerId,
            total: totalFinal,
          },
          {
            idempotencyKey: `sportcomplex-pos-${reserva.id}`,
          },
        );
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("STRIPE_NOT_CONFIGURED")) {
          return fail("STRIPE_NOT_CONFIGURED", "La pasarela de pago no está configurada.", 503);
        }
        console.error("Error creando PaymentIntent POS:", err);
        return fail("PAYMENT_INTENT_FAILED", "No se pudo iniciar el cobro con Stripe.", 502);
      }

      return ok({
        success: true,
        booking: {
          id: reserva.id,
          code: `AKR-POS-${reserva.id.slice(0, 8).toUpperCase()}`,
          client: input.clienteNombre,
          document: input.clienteDocumento,
          email: input.clienteEmail,
          service: servicio.nombre,
          date: input.date,
          time: input.slotTime,
          attendees: input.cantidadCupos,
          amount: totalFinal,
          subtotal,
          iva,
          discount: descuentoMonto,
          status: "PENDIENTE_PAGO",
          canal: "TAQUILLA",
          vendedorId: sellerId,
          paymentMode: input.paymentMode,
          stripePaymentIntentId: paymentIntent.paymentIntentId,
        },
        paymentIntent: {
          id: paymentIntent.paymentIntentId,
          clientSecret: paymentIntent.clientSecret,
          client_secret: paymentIntent.clientSecret,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
        },
        receiptUrl: `/api/pdf/receipt?reservaId=${reserva.id}&destinatario=POS`,
      });
    } catch (error: unknown) {
      console.error("Error en POST /api/pos/checkout:", error);
      return fail("SERVER_ERROR", "Error al procesar la venta en taquilla POS.", 500);
    }
  };
}
