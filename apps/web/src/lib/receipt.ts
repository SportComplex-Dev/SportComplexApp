import { buildTicketQrPayload, signTicket } from "@sportcomplex/core";
import {
  getReceiptReserva,
  ReceiptError,
  type ReceiptData,
} from "@sportcomplex/db";
import { type CanonicalRole } from "@/lib/session";

/**
 * TSK-BE-19 — Orquestador de `GET /api/pdf/receipt` (HU-19 / RF-17 / RNF-05).
 *
 * Concentra aquí toda la lógica de negocio para que la ruta sea un cable
 * (`auth` → parseo → `construirComprobante` → `ok`) y para poder probarla sin
 * sesión ni Next.js (mismo criterio que `lib/access.ts`).
 *
 * REGLA DE ORO (criterio de aceptación): este módulo es la única fuente de
 * datos del comprobante. Todo se arma en el servidor —incluida la firma HMAC
 * del QR y la imagen PNG— y el JSON de salida jamás contiene claves de
 * infraestructura (`QR_HMAC_SECRET`, `STRIPE_SECRET_KEY`, `DATABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`, …) ni identificadores de pago de Stripe.
 */

export type ComprobanteDestinatario = "PORTAL" | "POS";

export interface ComprobanteSolicitante {
  /** Usuario autenticado (`session.user.id`). */
  userId: string;
  /** Rol canónico: `Cliente`, `Empleado_Vendedor` o `Administrador`. */
  role: CanonicalRole | null;
  /** Canal desde el que se pide: portal del cliente o taquilla POS. */
  destinatario: ComprobanteDestinatario;
}

export interface MembreteComprobante {
  entidad: string;
  nit: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  pie: string | null;
}

export interface ComprobanteData {
  membrete: MembreteComprobante;
  emision: {
    documento: "COMPROBANTE_DE_RESERVA";
    generadoEn: string;
    zonaHoraria: string;
    moneda: "COP";
    /** Canal desde el que se emite: `PORTAL` (HU-19) o `POS` (RF-17). */
    destinatario: ComprobanteDestinatario;
  };
  reserva: {
    id: string;
    estado: string;
    canal: string;
    cantidadCupos: number;
    creadaEn: string;
    subtotal: string;
    descuentoPct: string;
    total: string;
  };
  servicio: {
    id: number;
    nombre: string;
    modalidad: string;
    /** `YYYY-MM-DD` (fecha local de Bogotá). */
    fecha: string;
    /** `HH:MM:SS` (hora local de Bogotá, tal como se guarda en la BD). */
    horaInicio: string;
    horaFin: string;
    /** Instantes ISO de apertura y cierre de la franja. */
    ventana: { inicio: string; fin: string };
  };
  titular: { id: string; nombre: string; correo: string | null };
  ticket: {
    id: string;
    estado: "EMITIDO" | "USADO";
    emitidoEn: string;
    usadoEn: string | null;
  } | null;
  qr: {
    /** Contenido a codificar; el lector lo separa con `parseTicketQrPayload`. */
    payload: string;
    /** PNG en base64 (`data:image/png;base64,...`) generado en el servidor. */
    dataUrl: string;
  } | null;
}

export interface ComprobanteOptions {
  solicitante: ComprobanteSolicitante;
  /** `QR_HMAC_SECRET`. Se usa para firmar y NUNCA se devuelve. */
  qrSecret: string;
  membrete?: MembreteComprobante;
  now?: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db?: any;
  /** Inyectable para pruebas; por defecto `qrcode` → PNG en el servidor. */
  generarQrDataUrl?: (payload: string) => Promise<string>;
}

const BOGOTA_TIME_ZONE = "America/Bogota";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DESTINATARIOS: readonly ComprobanteDestinatario[] = ["PORTAL", "POS"];

export class ReceiptAccessError extends ReceiptError {
  constructor(message: string, code: string, status: number) {
    super(message, code, status);
    this.name = "ReceiptAccessError";
  }
}

/** Membrete por defecto; se sobreescribe con variables de entorno. */
export function leerMembrete(
  env: Record<string, string | undefined> = process.env,
): MembreteComprobante {
  const limpio = (valor?: string): string | null => {
    const texto = valor?.trim();
    return texto ? texto : null;
  };
  return {
    entidad: limpio(env.RECEIPT_ENTIDAD) ?? "SportComplex — Complejo Deportivo",
    nit: limpio(env.RECEIPT_NIT),
    direccion: limpio(env.RECEIPT_DIRECCION),
    telefono: limpio(env.RECEIPT_TELEFONO),
    correo: limpio(env.RECEIPT_CORREO),
    pie: limpio(env.RECEIPT_PIE),
  };
}

export function validarSolicitudComprobante(input: {
  reservaId: string | null;
  destinatario: string | null;
}): { reservaId: string; destinatario: ComprobanteDestinatario } {
  if (!input.reservaId || !UUID_RE.test(input.reservaId)) {
    throw new ReceiptError(
      "El parámetro reservaId debe ser el UUID de una reserva.",
      "VALIDATION_ERROR",
      400,
    );
  }
  if (!input.destinatario || !DESTINATARIOS.includes(input.destinatario as ComprobanteDestinatario)) {
    throw new ReceiptError(
      "El parámetro destinatario debe ser PORTAL o POS.",
      "VALIDATION_ERROR",
      400,
    );
  }
  return {
    reservaId: input.reservaId,
    destinatario: input.destinatario as ComprobanteDestinatario,
  };
}

/**
 * Aislamiento por titular: el cliente solo descarga comprobantes propios; el
 * vendedor/administrador sí puede emitirlos en taquilla (RF-17).
 */
export function autorizarComprobante(input: {
  solicitante: ComprobanteSolicitante;
  titularId: string;
}): void {
  const { solicitante } = input;
  const esTitular = solicitante.userId === input.titularId;
  const esStaff =
    solicitante.role === "Administrador" || solicitante.role === "Empleado_Vendedor";
  if (esStaff || (esTitular && solicitante.role === "Cliente")) {
    // `POS` identifica un comprobante impreso en taquilla (RF-17): solo el
    // personal puede estamparlo, aunque sea sobre una reserva propia.
    if (solicitante.destinatario === "POS" && !esStaff) {
      throw new ReceiptAccessError(
        "El comprobante de taquilla solo lo puede emitir el personal autorizado.",
        "RECEIPT_FORBIDDEN",
        403,
      );
    }
    return;
  }

  throw new ReceiptAccessError(
    esTitular
      ? "Solo el personal de taquilla puede emitir este comprobante."
      : "No puedes descargar el comprobante de una reserva ajena.",
    "RECEIPT_FORBIDDEN",
    403,
  );
}

function monto(value: unknown): string {
  const numero =
    typeof value === "number" ? value : Number(String(value ?? Number.NaN).replace(/,/g, ""));
  if (!Number.isFinite(numero) || numero < 0) {
    throw new ReceiptError("El monto de la reserva no es válido.", "RECEIPT_INCOMPLETE", 409);
  }
  return numero.toFixed(2);
}

/** Instante de la franja: fecha local (Bogotá) + hora guardada en la BD. */
function instanteDeFranja(fecha: Date, hora: Date): Date {
  return new Date(`${fecha.toISOString().slice(0, 10)}T${hora.toISOString().slice(11, 19)}-05:00`);
}

function horaLegible(hora: Date): string {
  return hora.toISOString().slice(11, 19);
}

async function qrDataUrlPorDefecto(payload: string): Promise<string> {
  // Import diferido: `qrcode` solo se carga cuando de verdad se emite un QR.
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}

/**
 * Arma el DTO del comprobante a partir de la reserva leída en el servidor.
 * Lanza `ReceiptError` (400/403/404/409) — la ruta los traduce a respuestas HTTP.
 */
export async function construirComprobante(
  reservaId: string,
  options: ComprobanteOptions,
): Promise<ComprobanteData> {
  const { solicitante, qrSecret } = options;
  if (!qrSecret.trim()) {
    throw new ReceiptError("Falta QR_HMAC_SECRET.", "QR_NOT_CONFIGURED", 503);
  }

  const reserva: ReceiptData = await getReceiptReserva(reservaId, options.db);
  autorizarComprobante({ solicitante, titularId: reserva.titular.id });

  const { disponibilidad, titular, ticketQr } = reserva;
  const inicio = instanteDeFranja(disponibilidad.fecha, disponibilidad.franja.horaInicio);
  const fin = instanteDeFranja(disponibilidad.fecha, disponibilidad.franja.horaFin);

  // Firma en servidor: el `payload` que ve el cliente es el que se valida en
  // portería (RF-13), pero el secreto nunca sale de aquí.
  const payload = ticketQr
    ? buildTicketQrPayload(ticketQr.codigoUuid, signTicket(ticketQr.codigoUuid, qrSecret))
    : null;
  const qr = payload
    ? {
        payload,
        dataUrl: await (options.generarQrDataUrl ?? qrDataUrlPorDefecto)(payload),
      }
    : null;

  return {
    membrete: options.membrete ?? leerMembrete(),
    emision: {
      documento: "COMPROBANTE_DE_RESERVA",
      generadoEn: (options.now ?? new Date()).toISOString(),
      zonaHoraria: BOGOTA_TIME_ZONE,
      moneda: "COP",
      destinatario: solicitante.destinatario,
    },
    reserva: {
      id: reserva.id,
      estado: reserva.estado,
      canal: reserva.canal,
      cantidadCupos: reserva.cantidadCupos,
      creadaEn: reserva.creadoEn.toISOString(),
      subtotal: monto(reserva.subtotal),
      descuentoPct: Number(monto(reserva.descuentoPct)).toFixed(2),
      total: monto(reserva.total),
    },
    servicio: {
      id: disponibilidad.servicio.id,
      nombre: disponibilidad.servicio.nombre,
      modalidad: disponibilidad.servicio.modalidad,
      fecha: disponibilidad.fecha.toISOString().slice(0, 10),
      horaInicio: horaLegible(disponibilidad.franja.horaInicio),
      horaFin: horaLegible(disponibilidad.franja.horaFin),
      ventana: { inicio: inicio.toISOString(), fin: fin.toISOString() },
    },
    titular: { id: titular.id, nombre: titular.nombre, correo: titular.correo || null },
    ticket: ticketQr
      ? {
          id: ticketQr.id,
          estado: ticketQr.estado,
          emitidoEn: ticketQr.emitidoEn.toISOString(),
          usadoEn: ticketQr.usadoEn ? ticketQr.usadoEn.toISOString() : null,
        }
      : null,
    qr,
  };
}