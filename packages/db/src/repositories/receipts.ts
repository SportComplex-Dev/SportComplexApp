import { prisma } from "../client";

/**
 * TSK-BE-19 — Datos del comprobante en PDF (HU-19 / RF-17 / RNF-05).
 *
 * ÚNICA lectura de `RESERVA` para el endpoint `GET /api/pdf/receipt`: trae
 * en una sola consulta el membrete de negocio (servicio + franja), el titular
 * y el boleto. Se seleccionan campos explícitos — nunca `pago` ni `membresia` —
 * para que ni el `stripe_payment_intent_id` ni el id de pago viajen al bundle
 * del navegador (criterio de aceptación de TSK-BE-19).
 */

export class ReceiptError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ReceiptError";
  }
}

export interface ReceiptTicket {
  id: string;
  codigoUuid: string;
  estado: "EMITIDO" | "USADO";
  emitidoEn: Date;
  usadoEn: Date | null;
}

export interface ReceiptData {
  id: string;
  estado: string;
  canal: string;
  cantidadCupos: number;
  subtotal: unknown;
  descuentoPct: unknown;
  total: unknown;
  creadoEn: Date;
  disponibilidad: {
    fecha: Date;
    franja: { horaInicio: Date; horaFin: Date };
    servicio: { id: number; nombre: string; modalidad: string; tarifa: unknown };
  };
  titular: { id: string; nombre: string; correo: string };
  /** `null` mientras el boleto no se ha emitido (RN-05). */
  ticketQr: ReceiptTicket | null;
}

/**
 * Carga la reserva con su disponibilidad, servicio, franja y titular, más el
 * boleto emitido si existe. Lanza `ReceiptError` (404) si la reserva no existe
 * y (409) si le faltan relaciones necesarias para emitir el comprobante.
 */
export async function getReceiptReserva(
  reservaId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any = prisma,
): Promise<ReceiptData> {
  const reserva = await db.reserva.findUnique({
    where: { id: reservaId },
    select: {
      id: true,
      estado: true,
      canal: true,
      cantidadCupos: true,
      subtotal: true,
      descuentoPct: true,
      total: true,
      creadoEn: true,
      disponibilidad: {
        select: {
          fecha: true,
          franja: { select: { horaInicio: true, horaFin: true } },
          servicio: { select: { id: true, nombre: true, modalidad: true, tarifa: true } },
        },
      },
      titular: { select: { id: true, nombre: true, correo: true } },
      ticketQr: {
        select: {
          id: true,
          codigoUuid: true,
          estado: true,
          emitidoEn: true,
          usadoEn: true,
        },
      },
    },
  });

  if (!reserva) {
    throw new ReceiptError("La reserva solicitada no existe.", "RECEIPT_NOT_FOUND", 404);
  }
  if (!reserva.disponibilidad || !reserva.titular) {
    throw new ReceiptError(
      "La reserva no tiene datos completos para emitir el comprobante.",
      "RECEIPT_INCOMPLETE",
      409,
    );
  }

  return reserva as ReceiptData;
}