/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";

const { createMockPrisma } = await import(
  "../../../../../../../packages/db/test/mock-prisma"
);
const mock = createMockPrisma();
(globalThis as any).__scPrisma = mock;

const { POST } = await import("../checkout/route");
const { verifyTicketSignature, parseTicketQrPayload } = await import("@sportcomplex/core");

const VENDEDOR_ID = "00000000-0000-4000-8000-000000000020";
const CLIENTE_ID = "00000000-0000-4000-8000-000000000001";
const QR_SECRET = "test-pos-qr-secret-12345";
process.env.QR_HMAC_SECRET = QR_SECRET;

function resetDb() {
  for (const key of [
    "usuarios",
    "servicios",
    "franjas",
    "disponibilidades",
    "reservas",
    "tickets",
    "pagos",
  ] as const) {
    mock._state[key].length = 0;
  }

  mock._state.usuarios.push(
    { id: VENDEDOR_ID, nombre: "Vendedor Taquilla", correo: "vendedor@akros.test", estado: "ACTIVO", rolId: 2, rolNombre: "VENDEDOR" },
    { id: CLIENTE_ID, nombre: "Cliente Mostrador", correo: "cliente@akros.test", estado: "ACTIVO", rolId: 1, rolNombre: "CLIENTE" },
  );

  mock._state.servicios.push({
    id: 10,
    categoriaId: 1,
    nombre: "Cancha Pádel 1",
    capacidadMaxima: 4,
    tarifa: 80000,
    modalidad: "EXCLUSIVA",
    tipoPiscina: null,
    estado: "ACTIVO",
  });
}

test("POS API: 401 si no hay sesión autenticada", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = null;

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 401);
});

test("POS API: 403 si el rol autenticado es Cliente (exclusivo para Taquilla)", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: CLIENTE_ID, email: "cliente@akros.test", role: "Cliente" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 403);
});

test("POS API (RN-13 / RF-17): 400 si se intenta pagar en efectivo (cero efectivo)", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      clienteNombre: "Juan",
      clienteDocumento: "10203040",
      clienteEmail: "juan@test.com",
      paymentMode: "cash", // Prohibido
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("POS API (TSK-FE-18 / RF-17): venta presencial exitosa 100% cashless con Stripe", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      clienteTelefono: "3001234567",
      esSocio: true, // Debe aplicar 30% de descuento
      paymentMode: "stripe_card",
      cardLast4: "4242",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.booking.status, "CONFIRMADA");
  assert.equal(json.data.booking.canal, "TAQUILLA");
  assert.equal(json.data.booking.vendedorId, VENDEDOR_ID);
  // Tarifa 80000 con 30% de descuento = 56000
  assert.equal(json.data.booking.amount, 56000);
  assert.ok(json.data.booking.stripePaymentIntentId.startsWith("pi_pos_"));

  // Verificar QR firmado generado
  assert.ok(json.data.ticket.qrPayload);
  const parsedQr = parseTicketQrPayload(json.data.ticket.qrPayload);
  assert.ok(parsedQr);
  if (parsedQr) {
    const signatureValid = verifyTicketSignature(parsedQr.ticketId, parsedQr.signature, QR_SECRET);
    assert.equal(signatureValid, true);
  }
});

test("POS API (SRS §11.1 Riesgo 2): genera enlace de pago alternativo si se solicita", async () => {
  resetDb();
  (globalThis as any).__scAuthSession = {
    user: { id: VENDEDOR_ID, email: "vendedor@akros.test", role: "Empleado_Vendedor" },
  };

  const req = new Request("http://localhost:3000/api/pos/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      serviceId: 10,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_link",
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.data.booking.paymentMode, "stripe_link");
  assert.ok(json.data.booking.alternativePaymentUrl.includes("checkout?session_id="));
});
