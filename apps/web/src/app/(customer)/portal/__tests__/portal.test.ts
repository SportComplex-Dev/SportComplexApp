import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, type Booking } from "@sportcomplex/core";
import {
  clasificarReservas,
  calcularDesgloseComprobante,
  obtenerProximaReserva,
  generarQRDataUrl,
  obtenerSaludoContextual,
  formatSlotTime,
} from "@/components/portal/portal-utils";

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
  const code = "SC1:a5b4c3d2-e1f0-4a8b-9c7d-6e5f4a3b2c1d:mocksignature778899";
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
