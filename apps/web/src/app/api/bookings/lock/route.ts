import { authorizeApiRequest } from "@/lib/api-auth";
import {
  BookingError,
  compensateFailedCheckout,
  createBookingHold,
} from "@sportcomplex/db";
import { createStripeCheckoutSession } from "@sportcomplex/core";
import { bookingRequestSchema } from "@sportcomplex/validation";
import { fail, created } from "@/lib/api-response";

/**
 * TSK-BE-09 — POST /api/bookings/lock (HU-09 / RF-08 / RN-04 rev.).
 *
 * Endpoint EXCLUSIVO para iniciar el checkout con bloqueo temporal:
 *  1. TX1 (`createBookingHold`): FOR UPDATE + liberar expiradas + validar
 *     ventana/capacidad/bloqueo + `cuposOcupados += N` + `RESERVA
 *     PENDIENTE_PAGO` con `expiraEn = now + 30 min`, `pagoId = NULL`.
 *  2. Stripe Checkout Session (fuera de TX — I/O de red jamás bajo row-lock),
 *     con `expires_at` de 30 min y `metadata { bookingId, userId }`.
 *  3. Si Stripe falla: `compensateFailedCheckout` ejecuta
 *     `PENDIENTE_PAGO → EXPIRADA` + `cuposOcupados -= N` (misma lógica
 *     idempotente que el job de expiración; sin bloqueos huérfanos).
 *
 * TSK-BE-09 NO crea `PAGO`: la API de Stripe no expone el `pi_...` hasta
 * `checkout.session.completed`. La creación/asociación de `PAGO` (respetando
 * `stripe_payment_intent_id NOT NULL UNIQUE`) y las transiciones
 * `RESERVA → CONFIRMADA` / `PAGO → APROBADO/FALLIDO` pertenecen al webhook
 * RF-09, que localizará la reserva por `metadata.bookingId`.
 *
 * `POST /api/bookings` se mantiene intacto (hold sin Stripe).
 */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeApiRequest(["Cliente"]);
    if (!authorization.authorized) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("INVALID_PAYLOAD", "El cuerpo debe ser JSON válido.", 400);
    }
    const parsed = bookingRequestSchema.safeParse(body);
    if (!parsed.success) {
      return fail("VALIDATION_ERROR", "Datos de reserva inválidos.", 400, parsed.error.flatten());
    }

    // TX1 — bloqueo transaccional + RESERVA PENDIENTE_PAGO con TTL 30 min.
    const hold = await createBookingHold({
      ...parsed.data,
      userId: authorization.actor.id,
    });

    // Stripe Checkout Session (fuera de cualquier transacción).
    let checkout;
    try {
      checkout = await createStripeCheckoutSession({
        reservaId: hold.id,
        userId: authorization.actor.id,
        total: hold.total,
        cantidadCupos: hold.cantidadCupos,
        servicioNombre: hold.disponibilidad?.servicio?.nombre,
      });
    } catch (err) {
      // Compensación: liberar el hold; nunca se crea PAGO.
      await compensateFailedCheckout(hold.id).catch((compErr) => {
        console.error("Fallo compensando el bloqueo tras error de Stripe:", compErr);
      });
      if (err instanceof Error && err.message.includes("STRIPE_NOT_CONFIGURED")) {
        return fail("STRIPE_NOT_CONFIGURED", "La pasarela de pago no está configurada.", 503);
      }
      console.error("Error creando Checkout Session:", err);
      return fail("CHECKOUT_STRIPE_FAILED", "No se pudo iniciar el pago con Stripe.", 502);
    }

    return created({
      reserva: hold,
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
    console.error("Error en POST /api/bookings/lock:", error);
    return fail("SERVER_ERROR", "Error al procesar el bloqueo de checkout.", 500);
  }
}
