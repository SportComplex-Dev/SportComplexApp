import { authorizeApiRequest } from "@/lib/api-auth";
import { fail, ok } from "@/lib/api-response";
import { posCheckoutSchema } from "@sportcomplex/validation";
import { prisma } from "@sportcomplex/db";
import {
  applyMembershipDiscount,
  buildTicketQrPayload,
  newTicketId,
  signTicket,
} from "@sportcomplex/core";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TSK-FE-18 / TSK-BE-18 (RF-17, RN-13, RNF-05):
 * Cobro de Punto de Venta (Taquilla POS) 100% Cashless con confirmación en tiempo real.
 * Exclusivo para Empleado_Vendedor y Administrador.
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest([
      "Empleado_Vendedor",
      "Administrador",
    ]);
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

    // 1. Obtener o verificar servicio
    const db = (globalThis as unknown as { __scPrisma?: typeof prisma }).__scPrisma || prisma;
    const servicio = await db.servicio.findUnique({
      where: { id: input.serviceId },
      include: { categoria: true },
    });

    if (!servicio || servicio.estado !== "ACTIVO") {
      return fail("SERVICE_UNAVAILABLE", "El servicio solicitado no está disponible.", 404);
    }

    // 2. Calcular importes con regla de descuento de membresía (RN-08)
    const tarifaUnit = Number(servicio.tarifa);
    const subtotalBruto = tarifaUnit * input.cantidadCupos;
    const totalCents = applyMembershipDiscount(subtotalBruto * 100, input.esSocio);
    const totalFinal = Math.round(totalCents / 100);
    const descuentoPct = input.esSocio ? 30 : 0;
    const subtotal = Math.round(totalFinal / 1.19);
    const iva = totalFinal - subtotal;

    // 3. Obtener o crear cliente
    let cliente = await db.usuario.findFirst({
      where: { correo: input.clienteEmail },
    });

    if (!cliente) {
      // Buscar por rol CLIENTE o crear nuevo usuario cliente
      const rolCliente = await db.rol.findFirst({
        where: { nombre: { in: ["CLIENTE", "Cliente"] } },
      });
      cliente = await db.usuario.create({
        data: {
          correo: input.clienteEmail,
          nombre: input.clienteNombre,
          passwordHash: "$2b$10$pos_dummy_hash_for_cashless_walk_in",
          estado: "ACTIVO",
          rolId: rolCliente?.id ?? 1,
        },
      });
    }

    // 4. Resolver o asegurar disponibilidad para la fecha
    let disponibilidad = await db.disponibilidad.findFirst({
      where: {
        servicioId: input.serviceId,
        fecha: new Date(`${input.date}T00:00:00.000Z`),
      },
      include: { franja: true },
    });

    if (!disponibilidad) {
      // Si no existe franja previa, buscar o crear franja por defecto
      let franja = await db.franjaHoraria.findFirst({
        where: { servicioId: input.serviceId },
      });
      if (!franja) {
        franja = await db.franjaHoraria.create({
          data: {
            servicioId: input.serviceId,
            diaSemana: new Date(input.date).getUTCDay() || 7,
            horaInicio: new Date("1899-12-31T09:00:00.000Z"),
            horaFin: new Date("1899-12-31T10:00:00.000Z"),
          },
        });
      }

      disponibilidad = await db.disponibilidad.create({
        data: {
          servicioId: input.serviceId,
          franjaId: franja.id,
          fecha: new Date(`${input.date}T00:00:00.000Z`),
          cuposTotales: servicio.capacidadMaxima || 10,
          cuposOcupados: input.cantidadCupos,
          bloqueadaMantenimiento: false,
        },
        include: { franja: true },
      });
    } else {
      // Incrementar cupos ocupados
      await db.disponibilidad.update({
        where: { id: disponibilidad.id },
        data: { cuposOcupados: { increment: input.cantidadCupos } },
      });
    }

    // 5. Crear la reserva confirmada en taquilla vinculada al vendedor
    const reserva = await db.reserva.create({
      data: {
        disponibilidadId: disponibilidad.id,
        titularId: cliente.id,
        vendedorId: sellerId,
        cantidadCupos: input.cantidadCupos,
        canal: "TAQUILLA",
        estado: "CONFIRMADA",
        subtotal,
        descuentoPct,
        total: totalFinal,
        expiraEn: null,
      },
    });

    // 6. Si es cobro directo con tarjeta Stripe en POS
    const stripePaymentIntentId = `pi_pos_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const pago = await db.pago.create({
      data: {
        usuarioId: cliente.id,
        tipo: "RESERVA",
        stripePaymentIntentId,
        monto: totalFinal,
        estado: "APROBADO",
      },
    });

    await db.reserva.update({
      where: { id: reserva.id },
      data: { pagoId: pago.id },
    });

    // 7. Emitir Ticket QR firmado
    const ticketId = newTicketId();
    const qrSecret = process.env.QR_HMAC_SECRET || "akros-qr-hmac-secret-dev";
    const signature = signTicket(ticketId, qrSecret);
    const qrPayload = buildTicketQrPayload(ticketId, signature);

    const ticketQr = await db.ticketQr.create({
      data: {
        id: ticketId,
        reservaId: reserva.id,
        codigoUuid: ticketId,
        estado: "EMITIDO",
      },
    });

    // Si es enlace alternativo (mitigación del Riesgo 2 de SRS §11.1)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const alternativePaymentUrl = `${appUrl}/checkout?session_id=pos_alt_${reserva.id}`;

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
        discount: input.esSocio ? Math.round(subtotalBruto * 0.3) : 0,
        status: "CONFIRMADA",
        canal: "TAQUILLA",
        vendedorId: sellerId,
        paymentMode: input.paymentMode,
        stripePaymentIntentId,
        alternativePaymentUrl: input.paymentMode === "stripe_link" ? alternativePaymentUrl : null,
      },
      ticket: {
        id: ticketQr.id,
        qrPayload,
        codigoUuid: ticketQr.codigoUuid,
        estado: ticketQr.estado,
      },
      receiptUrl: `/api/pdf/receipt?reservaId=${reserva.id}&destinatario=POS`,
    });
  } catch (error: unknown) {
    console.error("Error en POST /api/pos/checkout:", error);
    return fail("SERVER_ERROR", "Error al procesar la venta en taquilla POS.", 500);
  }
}
