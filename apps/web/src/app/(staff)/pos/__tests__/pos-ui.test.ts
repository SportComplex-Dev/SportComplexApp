import test from "node:test";
import assert from "node:assert/strict";
import { applyMembershipDiscount } from "@sportcomplex/core";
import { posCheckoutSchema } from "@sportcomplex/validation";
import { calcularDesgloseComprobante } from "@/components/portal/portal-utils";
import QRCode from "qrcode";

// TSK-FE-18: Suite de Pruebas de la Interfaz y Lógica del Punto de Venta (Taquilla POS) 100% Cashless (HU-18 / RF-17 / RN-13)

test("TSK-FE-18 UI: Política 100% Cashless estricta — rechaza cualquier opción de efectivo", () => {
  // Probar que el contrato del POS solo acepta tarjeta o enlace alternativo
  const invalidCashOptions = ["cash", "efectivo", "caja_menor", "billetes", "fisico"];
  for (const method of invalidCashOptions) {
    const result = posCheckoutSchema.safeParse({
      serviceId: 1,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: method,
    });
    assert.equal(result.success, false, `El método ${method} debió ser rechazado por la política 100% cashless`);
  }

  // Métodos válidos
  assert.equal(
    posCheckoutSchema.safeParse({
      serviceId: 1,
      date: "2026-10-15",
      slotTime: "08:00 a. m. - 09:00 a. m.",
      cantidadCupos: 1,
      clienteNombre: "Carlos Santana",
      clienteDocumento: "1020304050",
      clienteEmail: "carlos@akros.test",
      paymentMode: "stripe_card",
    }).success,
    true,
  );
});

test("TSK-FE-18 UI (RN-08): Descuento automático del 30% para socios en mostrador", () => {
  const tarifaCancha = 80000; // COP
  const tarifaRegularCents = tarifaCancha * 100;

  // Cliente regular (no socio)
  const totalRegularCents = applyMembershipDiscount(tarifaRegularCents, false);
  assert.equal(totalRegularCents / 100, 80000);

  // Cliente socio (membresía activa)
  const totalSocioCents = applyMembershipDiscount(tarifaRegularCents, true);
  // 80000 * 0.70 = 56000
  assert.equal(totalSocioCents / 100, 56000);

  // Desglose fiscal sobre valor final de socio
  const { subtotal, iva, total } = calcularDesgloseComprobante(totalSocioCents / 100);
  assert.equal(total, 56000);
  assert.equal(subtotal + iva, 56000);
});

test("TSK-FE-18 UI (SRS §11.1 Riesgo 2): Generación de enlace alternativo y código QR para pago móvil", async () => {
  const tempBookingId = "pos-alt-123456";
  const appOrigin = "https://akros.sportcomplex.co";
  const serviceName = "Cancha Pádel 1";
  const total = 56000;

  const generatedUrl = `${appOrigin}/checkout?session_id=${tempBookingId}&service=${encodeURIComponent(serviceName)}&amount=${total}`;
  assert.ok(generatedUrl.includes("session_id=pos-alt-123456"));
  assert.ok(generatedUrl.includes("amount=56000"));

  // Generar QR para escaneo en mostrador con el teléfono del cliente
  const qrDataUrl = await QRCode.toDataURL(generatedUrl, { width: 320, margin: 2 });
  assert.ok(qrDataUrl.startsWith("data:image/png;base64,"));
  assert.ok(qrDataUrl.length > 500);
});

test("TSK-FE-18 UI (RF-17 / RNF-05): Comprobante de venta y pase con código QR para torniquete", async () => {
  const ticketCode = "AKR-POS-2026-9988";
  const qrData = `SC1:${ticketCode}:firma_hmac_sha256_mock`;

  const qrDataUrl = await QRCode.toDataURL(qrData, { width: 260, margin: 2 });
  assert.ok(qrDataUrl.startsWith("data:image/png;base64,"));

  const desglose = calcularDesgloseComprobante(80000);
  assert.equal(desglose.total, 80000);
  assert.equal(desglose.subtotal, 67227); // 80000 / 1.19
  assert.equal(desglose.iva, 12773);
});
