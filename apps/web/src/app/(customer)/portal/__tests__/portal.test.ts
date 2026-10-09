import test from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatMoney, type Booking } from "@sportcomplex/core";

// TSK-FE-13: Tests de Componentes y Lógica de UI del Portal de Autogestión (SCRUM-123 / HU-13 / RF-12)

/**
 * 1. Simulación de la función interna de filtrado de reservas por pestaña del Portal
 * según el requerimiento funcional RF-12 y la implementación real en PortalPage.
 */
function clasificarReservas(reservas: Booking[]) {
  const activas = reservas.filter((b) => b.status === "Confirmada");
  const historial = reservas.filter(
    (b) => b.status === "Usada" || b.status === "Pendiente"
  );
  const canceladas = reservas.filter(
    (b) => b.status === "Cancelada" || b.status === "CANCELADA_ADMINISTRATIVA"
  );
  return { activas, historial, canceladas };
}

/**
 * 2. Lógica de cálculo financiero del componente PrintableReceipt (Comprobante Digital / Voucher).
 */
function calcularDesgloseComprobante(amount: number) {
  const subtotal = Math.round(amount / 1.19);
  const iva = amount - subtotal;
  return {
    subtotal,
    iva,
    total: amount,
    subtotalFormateado: formatMoney(subtotal),
    ivaFormateado: formatMoney(iva),
    totalFormateado: formatMoney(amount),
  };
}

/**
 * 3. Lógica del componente QRGraphicHD (Generador de matriz de 21x21 para torniquetes ópticos).
 */
function generarMatrizQRHD(code: string) {
  const size = 21;
  const totalBlocks = size * size; // 441
  const blocks = Array.from({ length: totalBlocks }, (_, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    const inEye = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
    if (inEye) {
      const ax = x < 7 ? x : x - 14;
      const ay = y < 7 ? y : y - 14;
      return (
        ax === 0 ||
        ax === 6 ||
        ay === 0 ||
        ay === 6 ||
        (ax >= 2 && ax <= 4 && ay >= 2 && ay <= 4)
      );
    }
    return (x * 7 + y * 11 + x * y * 3) % 5 < 2;
  });

  return {
    totalBlocks,
    activeBlocksCount: blocks.filter(Boolean).length,
    labelAria: `Código QR de acceso para ticket ${code}`,
    blocks,
  };
}

/**
 * 4. Lógica de saludo contextual del componente de bienvenida del Portal (Bogotá UTC-5).
 */
function obtenerSaludoContextual(horaBogota: number): string {
  if (horaBogota < 12) return "Buenos días";
  if (horaBogota < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ============================================================================
// SUITE DE TESTS DE COMPONENTES (TSK-FE-13)
// ============================================================================

test("TSK-FE-13 Componentes: Clasificación de reservas en 3 pestañas (RF-12)", () => {
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

  // Tab Activas (Reservas confirmadas vigentes)
  assert.equal(activas.length, 1);
  assert.ok(activas.some((b) => b.id === "res-1" && b.status === "Confirmada"));

  // Tab Historial (Reservas pasadas usadas o pendientes de pago)
  assert.equal(historial.length, 3);
  assert.ok(historial.some((b) => b.id === "res-2" && b.status === "Pendiente"));
  assert.ok(historial.some((b) => b.id === "res-3" && b.status === "Usada"));
  assert.ok(historial.some((b) => b.id === "res-4" && b.status === "Usada"));

  // Tab Canceladas (Canceladas por cliente o administrativas)
  assert.equal(canceladas.length, 2);
  assert.ok(canceladas.some((b) => b.id === "res-5" && b.status === "Cancelada"));
  assert.ok(canceladas.some((b) => b.id === "res-6" && b.status === "CANCELADA_ADMINISTRATIVA"));
});

test("TSK-FE-13 Componentes: Matriz de código QR en alta definición (RF-10)", () => {
  const code = "ALT-2026-XYZ987";
  const qr = generarMatrizQRHD(code);

  // La matriz debe ser de 21x21 = 441 celdas
  assert.equal(qr.totalBlocks, 441);
  assert.equal(qr.blocks.length, 441);
  assert.ok(qr.activeBlocksCount > 100, "Debe tener bloques activos para representar el QR");
  assert.equal(qr.labelAria, `Código QR de acceso para ticket ${code}`);

  // Verificar ojos de alineación (Eye 1: x:0, y:0 debe estar activo)
  assert.equal(qr.blocks[0], true, "Esquina superior izquierda del ojo debe estar activa");
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

test("TSK-FE-13 Componentes: Saludo contextual según franja horaria", () => {
  assert.equal(obtenerSaludoContextual(8), "Buenos días");
  assert.equal(obtenerSaludoContextual(11), "Buenos días");
  assert.equal(obtenerSaludoContextual(12), "Buenas tardes");
  assert.equal(obtenerSaludoContextual(18), "Buenas tardes");
  assert.equal(obtenerSaludoContextual(20), "Buenas noches");
  assert.equal(obtenerSaludoContextual(23), "Buenas noches");
});

test("TSK-FE-13 Componentes: Formateo de fechas para tarjetas de tickets", () => {
  const fechaStr = "2026-10-15";
  const formateada = formatDate(fechaStr);
  assert.ok(formateada.length > 5, "Debe producir una fecha legible en español");
});
