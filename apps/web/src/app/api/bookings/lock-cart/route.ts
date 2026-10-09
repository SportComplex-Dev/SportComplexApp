import { auth } from "@/auth";
import {
  BookingError,
  compensateFailedCheckout,
  createBookingHoldCart,
} from "@sportcomplex/db";
import { createStripeCheckoutSession } from "@sportcomplex/core";
import { cartCheckoutSchema } from "@sportcomplex/validation";
import { fail, created } from "@/lib/api-response";

/**
 * SCRUM-163 / TSK-BE-12b — POST /api/bookings/lock-cart (HU-12 / RF-11 / RN-07).
 *
 * Endpoint para checkout de carrito multi-servicio:
 *  1. Valida body con cartCheckoutSchema (mínimo 2 ítems).
 *  2. TX1 (`createBookingHoldCart`): en una única transacción DB:
 *     - Lock filas de disponibilidad (orden determinista servicioId/fecha/franjaId).
 *     - Libera holds expirados aplicables.
 *     - Valida todo: aforo, mantenimiento, modalidad, ventana 15 días, solapamientos
 *       (reservas existentes + intra-carrito para mismo servicio).
 *     - Si cualquier ítem falla: abortar TX completa, cero holds parciales.
 *     - Incrementa cuposOcupados y crea todas las RESERVA en PENDIENTE_PAGO
 *       con MISMO expiraEn (TTL 30 min).
 *  3. Stripe Checkout Session (fuera de TX) con line_items por servicio y
 *     metadata { bookingIds: "id1,id2,...", userId }.
 *  4. Si Stripe falla (error definitivo): compensar TODOS los holds con
 *     compensateFailedCheckout por cada reserva (idempotente).
 *  5. NO compensar por timeout/resultado incierto: confiar en TTL + job TSK-BD-08.
 *
 * El endpoint individual POST /api/bookings/lock se mantiene intacto.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("UNAUTHORIZED", "Debes iniciar sesión para reservar.", 401);
    }
    if (session.user.role?.toUpperCase() !== "CLIENTE" || session.user.estado !== "ACTIVO") {
      return fail("FORBIDDEN", "Solo una cuenta de cliente activa puede reservar en línea.", 403);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }

    const parsed = cartCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de carrito inválidos.", 400, parsed.error.flatten());
    }

    // TX1 — bloqueo transaccional atómico multi-ítem + RESERVAS PENDIENTE_PAGO con TTL 30 min.
    const cartResult = await createBookingHoldCart({
      items: parsed.data.items,
      userId: session.user.id,
    });

    // Stripe Checkout Session consolidada (fuera de cualquier transacción).
    let checkout;
    try {
      checkout = await createStripeCheckoutSession({
        reservaIds: cartResult.bookings.map((b) => b.id),
        userId: session.user.id,
        total: cartResult.total,
        items: cartResult.bookings.map((b) => ({
          reservaId: b.id,
          servicioNombre: b.disponibilidad.servicio.nombre,
          cantidadCupos: b.cantidadCupos,
          subtotal: Number(b.subtotal),
        })),
      });
    } catch (err) {
      // Compensación: liberar TODOS los holds del carrito; nunca se crea PAGO.
      await Promise.all(
        cartResult.bookings.map((b) =>
          compensateFailedCheckout(b.id).catch((compErr) => {
            console.error(`Fallo compensando reserva ${b.id} tras error de Stripe:`, compErr);
          }),
        ),
      );
      if (err instanceof Error && err.message.includes("STRIPE_NOT_CONFIGURED")) {
        return fail("STRIPE_NOT_CONFIGURED", "La pasarela de pago no está configurada.", 503);
      }
      console.error("Error creando Checkout Session para carrito:", err);
      return fail("CHECKOUT_STRIPE_FAILED", "No se pudo iniciar el pago con Stripe.", 502);
    }

    return created({
      reservas: cartResult.bookings,
      checkout: {
        sessionId: checkout.sessionId,
        url: checkout.url,
        expiresAt: checkout.expiresAt,
      },
    });
  } catch (error: unknown) {
    if (error instanceof BookingError) {
      return fail(error.code, error.message, error.status);
    }
    console.error("Error en POST /api/bookings/lock-cart:", error);
    return fail("SERVER_ERROR", "Error al procesar el bloqueo de checkout del carrito.", 500);
  }
}