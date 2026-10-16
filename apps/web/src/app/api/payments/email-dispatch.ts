import { getReceiptReserva, type ClienteDb } from "@sportcomplex/db";
import { buildTicketQrPayload, signTicket } from "@sportcomplex/core";
import {
  sendReservationQrWebhook,
  type ReservationQrWebhookPayload,
} from "@sportcomplex/shared/lib";

function formatearHora(hora: Date): string {
  if (hora instanceof Date && !Number.isNaN(hora.getTime())) {
    return hora.toISOString().slice(11, 16);
  }
  return "00:00";
}

function formatearPrecioCop(total: unknown): string {
  const num = typeof total === "number" ? total : Number(total);
  if (Number.isFinite(num)) {
    return `$${Math.round(num).toLocaleString("es-CO")} COP`;
  }
  return String(total ?? "");
}

/**
 * TSK-BE-34 (HU-39 / RF-10): Orquestador de despacho transaccional de correo con QR.
 *
 * Carga los detalles de la reserva confirmada, firma el QR con HMAC-SHA256 del servidor
 * y despacha el payload hacia n8n de forma desacoplada y resiliente.
 */
export async function dispatchReservationTicketEmail(
  reservaId: string,
  db?: ClienteDb,
): Promise<void> {
  const receipt = await getReceiptReserva(reservaId, db);
  const { disponibilidad, titular, ticketQr } = receipt;

  const qrSecret = process.env.QR_HMAC_SECRET;
  let ticketId = receipt.id;
  let qrPayload = receipt.id;

  if (ticketQr?.codigoUuid) {
    ticketId = ticketQr.codigoUuid;
    if (qrSecret && qrSecret.trim().length > 0) {
      qrPayload = buildTicketQrPayload(
        ticketQr.codigoUuid,
        signTicket(ticketQr.codigoUuid, qrSecret),
      );
    } else {
      qrPayload = ticketQr.codigoUuid;
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://akros.lat";
  const portalUrl = `${appUrl}/portal/reservas/${receipt.id}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

  const fechaStr =
    disponibilidad.fecha instanceof Date
      ? disponibilidad.fecha.toISOString().slice(0, 10)
      : String(disponibilidad.fecha).slice(0, 10);

  const horaInicio = formatearHora(disponibilidad.franja.horaInicio);
  const horaFin = formatearHora(disponibilidad.franja.horaFin);
  const franjaHoraria = `${horaInicio} - ${horaFin}`;
  const precioTotal = formatearPrecioCop(receipt.total);

  const payload: ReservationQrWebhookPayload = {
    reservaId: receipt.id,
    ticketId,
    correo: titular.correo,
    email: titular.correo,
    nombre: titular.nombre,
    cancha: disponibilidad.servicio.nombre,
    sede: "AKROS Club",
    fecha: fechaStr,
    franjaHoraria,
    qrPayload,
    qrImageUrl,
    appUrl,
    usuario: {
      nombre: titular.nombre,
      email: titular.correo,
    },
    detalle: {
      servicioNombre: disponibilidad.servicio.nombre,
      fecha: fechaStr,
      horario: franjaHoraria,
      precioTotal,
      portalUrl,
    },
  };

  const resultado = await sendReservationQrWebhook(payload);
  if (!resultado.sent) {
    console.error(
      `Aviso TSK-BE-34: No se pudo despachar el correo con QR para la reserva ${reservaId}:`,
      resultado.error,
    );
  }
}

/**
 * Despacha de forma asíncrona y no bloqueante los correos de todas las reservas confirmadas.
 * Los fallos son capturados y registrados sin propagar excepciones hacia el webhook de pago.
 */
export async function dispatchReservationTicketsEmail(
  reservaIds: string[],
  db?: ClienteDb,
): Promise<void> {
  await Promise.allSettled(
    reservaIds.map(async (id) => {
      try {
        await dispatchReservationTicketEmail(id, db);
      } catch (err: unknown) {
        console.error(
          `Error en despacho de correo para reserva confirmada ${id}:`,
          err,
        );
      }
    }),
  );
}
