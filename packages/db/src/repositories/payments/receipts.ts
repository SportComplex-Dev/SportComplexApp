import { prisma } from "../../client";
import type { ClienteDb } from "../tipos-db";

/**
 * TSK-BE-19 — Datos del comprobante en PDF (HU-19 / RF-17 / RNF-05).
 *
 * Lectura de `RESERVA` para el endpoint `GET /api/pdf/receipt`: trae el membrete
 * de negocio, el titular y el boleto. Para un ticket consolidado consulta además
 * las filas asociadas al mismo pago y suma sus importes. Se seleccionan campos
 * explícitos — nunca `pago` ni `membresia` — y `pagoId` se elimina del DTO.
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
  inicioValidez: Date | null;
  finValidez: Date | null;
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

function sumAmounts(values: unknown[]): string | null {
  const amounts = values.filter((value) => value != null).map((value) => String(value));
  if (amounts.length === 0) return null;

  const parts = amounts.map((amount) => {
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(amount);
    if (!match) throw new Error("El pago contiene un monto inválido.");
    return { negative: match[1] === "-", whole: match[2]!, fraction: match[3] ?? "" };
  });
  const scale = Math.max(2, ...parts.map(({ fraction }) => fraction.length));
  const factor = 10n ** BigInt(scale);
  const sum = parts.reduce((total, part) => {
    const magnitude = BigInt(part.whole) * factor + BigInt(part.fraction.padEnd(scale, "0"));
    return total + (part.negative ? -magnitude : magnitude);
  }, 0n);
  const negative = sum < 0n;
  const absolute = negative ? -sum : sum;
  const whole = absolute / factor;
  const fraction = (absolute % factor).toString().padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Carga la reserva con su disponibilidad, servicio, franja y titular, más el
 * boleto emitido si existe. Lanza `ReceiptError` (404) si la reserva no existe
 * y (409) si le faltan relaciones necesarias para emitir el comprobante.
 */
export async function getReceiptReserva(
  reservaId: string,
    db: ClienteDb = prisma,
): Promise<ReceiptData> {
  const reserva = await db.reserva.findUnique({
    where: { id: reservaId },
    select: {
      id: true,
      pagoId: true,
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
          inicioValidez: true,
          finValidez: true,
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

  let subtotal: unknown = reserva.subtotal;
  let total: unknown = reserva.total;
  if (reserva.pagoId && reserva.ticketQr?.inicioValidez && reserva.ticketQr.finValidez) {
    const reservasDelPago = await db.reserva.findMany({
      where: { pagoId: reserva.pagoId },
      select: { subtotal: true, total: true },
    });
    subtotal = sumAmounts(reservasDelPago.map((item) => item.subtotal)) ?? subtotal;
    total = sumAmounts(reservasDelPago.map((item) => item.total)) ?? total;
  }

  // pagoId se usa solo para consolidar los importes y nunca sale en el DTO.
  const { pagoId: _pagoId, ...receipt } = reserva;
  return { ...receipt, subtotal, total } as ReceiptData;
}
