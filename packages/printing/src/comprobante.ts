import { Ticket } from "./ticket";

/**
 * Datos mínimos del comprobante para dibujar el ticket.
 *
 * Es un subconjunto estructural de `ComprobanteData` (`GET /api/pdf/receipt`):
 * el JSON de esa ruta se pasa tal cual, sin que este paquete dependa de
 * `apps/web`. Todo viene resuelto por el servidor —membrete, montos y el QR ya
 * firmado—; aquí solo se maqueta.
 */
export interface TicketComprobanteInput {
  membrete: {
    entidad: string;
    nit: string | null;
    direccion: string | null;
    telefono: string | null;
    correo: string | null;
    pie: string | null;
  };
  emision: { generadoEn: string; zonaHoraria?: string };
  reserva: {
    id: string;
    estado: string;
    canal: string;
    cantidadCupos: number;
    subtotal: string;
    descuentoPct: string;
    total: string;
  };
  servicio: {
    nombre: string;
    modalidad: string;
    /** `YYYY-MM-DD` */
    fecha: string;
    /** `HH:MM:SS` */
    horaInicio: string;
    horaFin: string;
  };
  titular: { nombre: string };
  ticket: { id: string; estado: string } | null;
  /** `payload` es el contenido firmado (`SC1:<uuid>:<hmac>`) que valida el escáner. */
  qr: { payload: string } | null;
}

const BOGOTA = "America/Bogota";

/** `30000.00` → `$30.000` (COP sin decimales, punto de miles). */
export function pesos(valor: string | number): string {
  const n = Math.round(Number(valor));
  return `$${String(Math.abs(Number.isFinite(n) ? n : 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

function fechaHora(iso: string, timeZone: string): { fecha: string; hora: string } {
  const d = new Date(iso);
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(d);
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(d);
  return { fecha, hora };
}

/** Número corto y legible de la reserva (los 8 primeros del UUID). */
export function numeroComprobante(reservaId: string): string {
  return reservaId.slice(0, 8).toUpperCase();
}

/** Maqueta del ticket de reserva, siguiendo la factura del prototipo `factura58`. */
export function construirTicketComprobante(c: TicketComprobanteInput): Ticket {
  const { membrete: m, reserva: r, servicio: s } = c;
  const { fecha, hora } = fechaHora(c.emision.generadoEn, c.emision.zonaHoraria ?? BOGOTA);
  const subtotal = Number(r.subtotal);
  const total = Number(r.total);
  const descuentoPct = Number(r.descuentoPct);

  const t = new Ticket();
  t.align(1).bold(true).size(0x11).text(m.entidad).size(0x00).bold(false);
  if (m.nit) t.line(`NIT ${m.nit}`);
  if (m.direccion) t.text(m.direccion);
  if (m.telefono) t.line(`Tel: ${m.telefono}`);
  if (m.correo) t.text(m.correo);
  t.feed(1);
  t.bold(true).line("COMPROBANTE DE RESERVA").line(`No. ${numeroComprobante(r.id)}`).bold(false);

  t.align(0).rule("-");
  t.pair("Fecha:", fecha).pair("Hora:", hora);
  t.rule("-");
  t.bold(true).line("TITULAR").bold(false).text(c.titular.nombre);
  t.rule("-");
  t.bold(true).line("SERVICIO").bold(false).text(s.nombre);
  t.pair("Modalidad:", s.modalidad);
  t.pair("Fecha:", s.fecha);
  t.pair("Franja:", `${s.horaInicio.slice(0, 5)}-${s.horaFin.slice(0, 5)}`);
  t.pair("Cupos:", String(r.cantidadCupos));
  t.rule("-");
  t.pair("Subtotal:", pesos(subtotal));
  if (descuentoPct > 0 && subtotal > total) {
    t.pair(`Descuento (${Number(descuentoPct.toFixed(2))}%):`, `-${pesos(subtotal - total)}`);
  }
  t.rule("=");
  t.bold(true).size(0x01).pair("TOTAL:", pesos(total)).size(0x00).bold(false);
  t.rule("=");
  t.pair("Canal:", r.canal).pair("Estado:", r.estado);

  t.feed(1).align(1);
  if (c.qr) {
    t.line("Presente este QR en la entrada").qr(c.qr.payload);
    if (c.ticket) t.line(`Ticket ${numeroComprobante(c.ticket.id)}`);
  } else {
    t.bold(true).line("PASE PENDIENTE DE EMISION").bold(false);
    t.text("El QR se emite al confirmar el pago.");
  }
  t.feed(1);
  if (m.pie) t.text(m.pie);
  else t.line("¡Gracias por su visita!");
  return t;
}
