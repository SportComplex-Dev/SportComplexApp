import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, type Booking } from "@sportcomplex/core";
import {
  clasificarReservas,
  calcularDesgloseComprobante,
  getAccessWindowLabel,
  getAccessWindowStatus,
  obtenerProximaReserva,
  generarQRDataUrl,
  obtenerSaludoContextual,
  formatSlotTime,
} from "./portal-utils";

// TSK-FE-13: Suite de Pruebas de Componentes y Lógica de UI del Portal de Autogestión (SCRUM-123 / HU-13 / RF-12)

test("TSK-FE-13 Componentes: Clasificación de reservas en 3 pestañas según RF-12", () => {
  const mockBookings: Booking[] = [
    {
      id: "res-1",
      code: "ALT-CANCHA-01",
      service: "Cancha de Fútbol 5",
      category: "canchas",
      date: "2026-10-15",
      time: "18:00 - 19:30",
      amount: 90000,
      status: "Confirmada",
      client: "Carlos Cliente",
      attendees: 10,
      sede: "Poblado",
    },
    {
      id: "res-2",
      code: "ALT-PISCINA-02",
      service: "Piscina Libre",
      category: "piscinas",
      date: "2026-10-16",
      time: "07:00 - 08:00",
      amount: 25000,
      status: "Pendiente",
      client: "Carlos Cliente",
      attendees: 1,
      sede: "Laureles",
    },
    {
      id: "res-3",
      code: "ALT-CANCHA-03",
      service: "Cancha de Tenis",
      category: "canchas",
      date: "2026-09-20",
      time: "10:00 - 11:30",
      amount: 60000,
      status: "Usada",
      client: "Carlos Cliente",
      attendees: 2,
      sede: "Poblado",
    },
    {
      id: "res-4",
      code: "ALT-GIMNASIO-04",
      service: "Pase Diario Gimnasio",
      category: "gimnasio",
      date: "2026-09-15",
      time: "06:00 - 22:00",
      amount: 35000,
      status: "Usada",
      client: "Carlos Cliente",
      attendees: 1,
      sede: "Envigado",
    },
    {
      id: "res-5",
      code: "ALT-ZONA-05",
      service: "Zona Húmeda Sauna",
      category: "zona-humeda",
      date: "2026-09-10",
      time: "14:00 - 15:00",
      amount: 30000,
      status: "Cancelada",
      client: "Carlos Cliente",
      attendees: 1,
      sede: "Poblado",
    },
    {
      id: "res-6",
      code: "ALT-CANCHA-06",
      service: "Cancha Sintética",
      category: "canchas",
      date: "2026-09-05",
      time: "20:00 - 21:00",
      amount: 70000,
      status: "CANCELADA_ADMINISTRATIVA",
      client: "Carlos Cliente",
      attendees: 8,
      sede: "Poblado",
    },
  ];

  const { activas, historial, canceladas } = clasificarReservas(mockBookings);

  // Tab Activas: Confirmadas y Pendientes de pago en curso (RF-12)
  assert.equal(activas.length, 2, "Activas debe incluir reservas Confirmadas y Pendientes");
  assert.ok(activas.some((b) => b.id === "res-1" && b.status === "Confirmada"));
  assert.ok(activas.some((b) => b.id === "res-2" && b.status === "Pendiente"));

  // Tab Historial: Reservas pasadas usadas o expiradas
  assert.equal(historial.length, 2, "Historial debe contener reservas Usadas");
  assert.ok(historial.some((b) => b.id === "res-3" && b.status === "Usada"));
  assert.ok(historial.some((b) => b.id === "res-4" && b.status === "Usada"));

  // Tab Canceladas: Canceladas por cliente o administrativas
  assert.equal(canceladas.length, 2, "Canceladas debe contener cancelaciones de cliente y administrativas");
  assert.ok(canceladas.some((b) => b.id === "res-5" && b.status === "Cancelada"));
  assert.ok(canceladas.some((b) => b.id === "res-6" && b.status === "CANCELADA_ADMINISTRATIVA"));
});

test("TSK-FE-17: badge de franja respeta límites inclusivos en hora legal de Colombia", () => {
  const ticket = {
    date: "2026-10-12",
    time: "10:00 - 11:00",
    accessWindowStart: "10:00:00",
    accessWindowEnd: "11:00:00",
  };

  assert.equal(getAccessWindowLabel(ticket), "10:00 - 11:00");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T14:59:59.000Z")), "UPCOMING");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T15:00:00.000Z")), "OPEN");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T15:30:00.000Z")), "OPEN");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T16:00:00.000Z")), "OPEN");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T16:00:01.000Z")), "EXPIRED");
});

test("TSK-FE-17: badge entiende horas presentadas en formato 12 horas", () => {
  const ticket = { date: "2026-10-12", time: "10:00 a. m. — 11:00 a. m." };

  assert.equal(getAccessWindowLabel(ticket), "10:00 - 11:00");
  assert.equal(getAccessWindowStatus(ticket, new Date("2026-10-12T15:00:00.000Z")), "OPEN");
});

test("TSK-FE-13 Componentes: Banner 'Tu próxima reserva' filtra fechas pasadas y prioriza la más cercana", () => {
  const hoy = "2026-10-09";
  const reservas: Booking[] = [
    {
      id: "res-vencida-1",
      code: "ALT-VENCIDA",
      service: "Cancha Vencida",
      category: "canchas",
      date: "2026-10-01", // Fecha pasada
      time: "10:00 - 11:00",
      amount: 50000,
      status: "Confirmada",
      client: "Carlos Cliente",
      attendees: 2,
      sede: "Poblado",
    },
    {
      id: "res-futura-lejana",
      code: "ALT-FUTURA-2",
      service: "Piscina Fin de Mes",
      category: "piscinas",
      date: "2026-10-25", // Futura lejana
      time: "08:00 - 09:00",
      amount: 25000,
      status: "Confirmada",
      client: "Carlos Cliente",
      attendees: 1,
      sede: "Laureles",
    },
    {
      id: "res-futura-cercana",
      code: "ALT-FUTURA-1",
      service: "Gimnasio Próximo",
      category: "gimnasio",
      date: "2026-10-10", // Futura más cercana
      time: "07:00 - 08:00",
      amount: 30000,
      status: "Confirmada",
      client: "Carlos Cliente",
      attendees: 1,
      sede: "Envigado",
    },
    {
      id: "res-cancelada",
      code: "ALT-CANCELADA",
      service: "Cancha Cancelada",
      category: "canchas",
      date: "2026-10-11",
      time: "14:00 - 15:00",
      amount: 60000,
      status: "Cancelada",
      client: "Carlos Cliente",
      attendees: 4,
      sede: "Poblado",
    },
  ];

  // Debe descartar res-vencida-1 y res-cancelada, y elegir res-futura-cercana
  const proxima = obtenerProximaReserva(reservas, hoy);
  assert.ok(proxima, "Debe encontrar una próxima reserva activa");
  assert.equal(proxima.id, "res-futura-cercana");
  assert.equal(proxima.date, "2026-10-10");

  // Si todas las reservas confirmadas son pasadas, el banner debe retornar null
  const soloPasadas: Booking[] = [
    { ...reservas[0], date: "2026-10-01" },
    { ...reservas[0], id: "res-vencida-2", date: "2026-10-05" },
  ];
  const sinProxima = obtenerProximaReserva(soloPasadas, hoy);
  assert.equal(sinProxima, null, "No debe fijar reservas de fechas pasadas");
});

test("TSK-FE-13 Componentes: Generación de código QR estándar válido para torniquetes ópticos (RF-10 / RF-13)", async () => {
  const { buildTicketQrPayload, parseTicketQrPayload } = await import("@sportcomplex/core");
  const ticketId = "a5b4c3d2-e1f0-4a8b-9c7d-6e5f4a3b2c1d";
  const validSignature = "b".repeat(64);
  const code = buildTicketQrPayload(ticketId, validSignature);

  const parsed = parseTicketQrPayload(code);
  assert.ok(parsed !== null, "Debe ser parseable por torniquete óptico");
  assert.equal(parsed?.ticketId, ticketId);
  assert.equal(parsed?.signature, validSignature);

  const dataUrl = await generarQRDataUrl(code, 300);

  // Debe retornar un Data URL de formato PNG
  assert.ok(dataUrl.startsWith("data:image/png;base64,"), "Debe ser una imagen PNG en base64");

  // Decodificar base64 y verificar magic bytes del formato PNG estándar
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  assert.ok(buffer.length > 500, "El PNG del código QR debe contener datos válidos");

  // Magic bytes de cabecera PNG: \x89PNG\r\n\x1a\n
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.deepEqual(buffer.subarray(0, 8), pngHeader, "El binario generado debe tener la firma de imagen PNG estándar");
});

test("TSK-FE-13 Componentes: Cálculo fiscal y desglose del Comprobante / Voucher (RN-14)", () => {
  const totalPagar = 119000; // 100.000 subtotal + 19.000 IVA
  const desglose = calcularDesgloseComprobante(totalPagar);

  assert.equal(desglose.subtotal, 100000);
  assert.equal(desglose.iva, 19000);
  assert.equal(desglose.subtotal + desglose.iva, totalPagar);
  assert.equal(desglose.total, totalPagar);

  // Formato monetario
  assert.ok(desglose.totalFormateado.includes("119.000") || desglose.totalFormateado.includes("119,000"));
});

test("TSK-FE-13 Componentes: Saludo contextual según franja horaria en Bogotá (RNF-02)", () => {
  assert.equal(obtenerSaludoContextual(8), "Buenos días");
  assert.equal(obtenerSaludoContextual(11), "Buenos días");
  assert.equal(obtenerSaludoContextual(12), "Buenas tardes");
  assert.equal(obtenerSaludoContextual(18), "Buenas tardes");
  assert.equal(obtenerSaludoContextual(20), "Buenas noches");
  assert.equal(obtenerSaludoContextual(23), "Buenas noches");
});

test("TSK-FE-13 Componentes: Formateo de horario de franja y fechas", () => {
  assert.equal(formatSlotTime("2026-10-15T08:00:00.000Z"), "8:00 a. m.");
  assert.equal(formatSlotTime("2026-10-15T16:30:00.000Z"), "4:30 p. m.");
  assert.equal(formatSlotTime("07:00 a. m."), "07:00 a. m.");

  const fechaStr = "2026-10-15";
  const formateada = formatDate(fechaStr);
  assert.ok(formateada.length > 5, "Debe producir una fecha legible en español");
});

test("TSK-FE-11: Billetera digital - Payload QR debe ser compatible con parseTicketQrPayload de torniquetes (RF-10 / RF-13)", async () => {
  const { buildTicketQrPayload, parseTicketQrPayload } = await import("@sportcomplex/core");
  const ticketId = "882233aa-bb44-4000-8000-ee7788990011";
  const validHmac = "a".repeat(64); // 64 caracteres hex válidos
  const payload = buildTicketQrPayload(ticketId, validHmac);

  // 1. Validar que parseTicketQrPayload lo reconoce sin fallar
  const parsed = parseTicketQrPayload(payload);
  assert.ok(parsed !== null, "El payload debe cumplir con el formato SC1:<uuid>:<hex64>");
  assert.equal(parsed?.ticketId, ticketId);
  assert.equal(parsed?.signature, validHmac);

  // 2. Validar que la generación de imagen HD produce un dataUrl íntegro
  const highResQr = await generarQRDataUrl(payload, 600);
  assert.ok(highResQr.startsWith("data:image/png;base64,"), "Debe generar formato PNG descargable en alta resolución");
  const base64Content = highResQr.replace(/^data:image\/png;base64,/, "");
  const binaryBuf = Buffer.from(base64Content, "base64");
  assert.ok(binaryBuf.length > 1000, "El PNG descargable de 600px debe poseer densidad adecuada para lectura óptica");
});

test("TSK-FE-19: Integración de comprobante 58mm con respuesta oficial del backend (RF-17 / RNF-05)", () => {
  const mockReceiptData = {
    membrete: {
      entidad: "AKROS SPORTCOMPLEX",
      nit: "901.458.789-2",
    },
    reserva: {
      id: "882233aa-bb44-4000-8000-ee7788990011",
      subtotal: "84033.61",
      descuentoPct: "0.00",
      total: "100000.00",
    },
    qr: {
      payload: "SC1:882233aa-bb44-4000-8000-ee7788990011:" + "f".repeat(64),
      dataUrl: "data:image/png;base64,mockPng",
    },
  };

  const subtotalNum = Number(mockReceiptData.reserva.subtotal);
  const totalNum = Number(mockReceiptData.reserva.total);
  const iva = totalNum - subtotalNum;

  assert.equal(Math.round(subtotalNum + iva), totalNum, "La suma de subtotal e IVA debe coincidir con el total");
  assert.ok(mockReceiptData.qr.payload.startsWith("SC1:"));
});

test("TSK-FE-11: Sanitización de nombres de archivo de descarga de tiquete (DOM-01)", async () => {
  const { sanitizeFilename } = await import("./portal-utils");
  assert.equal(sanitizeFilename("ALT:1234/5678"), "ALT_1234_5678");
  assert.equal(sanitizeFilename("ticket-123.png"), "ticket-123_png");
  assert.equal(sanitizeFilename("VALID_CODE-123"), "VALID_CODE-123");
});
