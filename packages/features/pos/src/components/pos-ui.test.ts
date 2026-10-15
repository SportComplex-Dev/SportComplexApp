/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";

// Asegurar React en globalThis para componentes JSX de paquetes externos
(globalThis as any).React = React;

import { applyMembershipDiscount, type CatalogItem, type Booking } from "@sportcomplex/core";
import { posCheckoutSchema } from "@sportcomplex/validation";
import QRCode from "qrcode";

import { PosCatalogSelector } from "./PosCatalogSelector";
import { PosClientForm } from "./PosClientForm";
import { PosPaymentStripe } from "./PosPaymentStripe";
import { PosVoucherModal } from "./PosVoucherModal";
import { PosAltLinkModal } from "./PosAltLinkModal";
import { calcularDesgloseComprobante } from "../services/receipt";

// TSK-FE-18: Suite de Pruebas de la Interfaz y Componentes POS 100% Cashless (HU-18 / RF-17 / RN-13)

const dummyServices: CatalogItem[] = [
  {
    id: "serv-1",
    name: "Cancha Pádel 1",
    category: "canchas",
    sede: "Poblado",
    price: 80000,
    status: "Disponible",
    capacity: 4,
    description: "Cancha de pádel techada",
  },
  {
    id: "serv-2",
    name: "Piscina Olímpica · Nado Libre",
    category: "piscinas",
    sede: "Laureles",
    price: 25000,
    status: "Disponible",
    capacity: 8,
    description: "Carril de nado libre",
  },
];

test("TSK-FE-18 UI: Política 100% Cashless estricta — rechaza cualquier opción de efectivo", () => {
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

test("TSK-FE-18 UI (RN-08): Descuento del 30% y desglose fiscal en taquilla", () => {
  const tarifaCancha = 80000;
  const tarifaRegularCents = tarifaCancha * 100;

  const totalRegularCents = applyMembershipDiscount(tarifaRegularCents, false);
  assert.equal(totalRegularCents / 100, 80000);

  const totalSocioCents = applyMembershipDiscount(tarifaRegularCents, true);
  assert.equal(totalSocioCents / 100, 56000);

  const { subtotal, iva, total } = calcularDesgloseComprobante(totalSocioCents / 100);
  assert.equal(total, 56000);
  assert.equal(subtotal + iva, 56000);
});

test("TSK-FE-18 UI (TEST-01 / CODE-02): PosCatalogSelector renderiza categorías, servicios y cumple WCAG", () => {
  const html = renderToString(
    React.createElement(PosCatalogSelector, {
      selectedCategory: "canchas",
      onSelectCategory: () => {},
      selectedServiceId: "serv-1",
      onSelectServiceId: () => {},
      selectedDate: "2026-10-15",
      onSelectDate: () => {},
      selectedSlot: "08:00 a. m. - 09:00 a. m.",
      onSelectSlot: () => {},
      attendees: 1,
      onSetAttendees: () => {},
      filteredServices: dummyServices,
      currentService: dummyServices[0],
      todayStr: "2026-10-15",
      availableSlots: ["08:00 a. m. - 09:00 a. m.", "09:00 a. m. - 10:00 a. m."],
    }),
  );

  // Verificación de estructura y accesibilidad WCAG (CODE-02)
  assert.ok(html.includes("Cancha Pádel 1"));
  assert.ok(html.includes("id=\"pos-date-input\""));
  assert.ok(html.includes("for=\"pos-date-input\""));
  assert.ok(html.includes("aria-pressed=\"true\""));
  assert.ok(html.includes("08:00 a. m."));
});

test("TSK-FE-18 UI (TEST-01 / CODE-02): PosClientForm renderiza campos con etiquetas asociadas (WCAG)", () => {
  const html = renderToString(
    React.createElement(PosClientForm, {
      clientDoc: "10203040",
      onClientDocChange: () => {},
      clientName: "Laura Gómez",
      onClientNameChange: () => {},
      clientEmail: "laura@akros.test",
      onClientEmailChange: () => {},
      clientPhone: "3001234567",
      onClientPhoneChange: () => {},
      isMember: true,
      onIsMemberChange: () => {},
      onQuickWalkIn: () => {},
    }),
  );

  // Verifica que todos los inputs tienen id y su label correspondiente con for (htmlFor)
  assert.ok(html.includes("for=\"pos-client-doc\""));
  assert.ok(html.includes("id=\"pos-client-doc\""));
  assert.ok(html.includes("for=\"pos-client-name\""));
  assert.ok(html.includes("id=\"pos-client-name\""));
  assert.ok(html.includes("for=\"pos-client-email\""));
  assert.ok(html.includes("id=\"pos-client-email\""));
  assert.ok(html.includes("for=\"pos-client-member\""));
  assert.ok(html.includes("id=\"pos-client-member\""));
  assert.ok(html.includes("Socio AKROS Vigente"));
});

test("TSK-FE-18 UI (SEC-01 / PCI-DSS): PosPaymentStripe NO contiene campos planos para PAN ni CVC", () => {
  const html = renderToString(
    React.createElement(PosPaymentStripe, {
      currentService: dummyServices[0],
      subtotalBruto: 80000,
      descuentoMonto: 24000,
      subtotalNeto: 47059,
      ivaMonto: 8941,
      totalFinal: 56000,
      isMember: true,
      isProcessing: false,
      processStep: "",
      onProcessPayment: () => {},
      onGenerateAltLink: () => {},
    }),
  );

  // Criterio de seguridad SEC-01: CERO campos vulnerables a captura insegura de PAN/CVC
  assert.ok(!html.includes("placeholder=\"4000"));
  assert.ok(!html.includes("placeholder=\"CVC\""));
  assert.ok(!html.includes("placeholder=\"MM/AA\""));

  // Verificación de interfaz segura con Stripe
  assert.ok(html.includes("Dat\u00e1fono Digital Stripe"));
  assert.ok(html.includes("PCI-DSS Seguro"));
  assert.ok(html.includes("Cobrar con Tarjeta Stripe"));
  assert.ok(html.includes("56.000"));
});

test("TSK-FE-18 UI (TEST-01 / RNF-05): PosVoucherModal renderiza comprobante imprimible con QR y membrete", () => {
  const dummyBooking: Booking = {
    id: "book-12345",
    code: "AKR-POS-9988",
    client: "Carlos Santana",
    category: "canchas",
    service: "Cancha Pádel 1",
    sede: "Poblado",
    date: "2026-10-15",
    time: "08:00 a. m. - 09:00 a. m.",
    attendees: 1,
    amount: 56000,
    status: "Confirmada",
    paymentMethod: "card",
    paymentStatus: "Aprobada",
    transactionRef: "pi_pos_test_123456",
  };

  const html = renderToString(
    React.createElement(PosVoucherModal, {
      booking: dummyBooking,
      sellerName: "Andrés Muñoz",
      receiptQrUrl: "data:image/png;base64,dummy_qr_code",
      onPrint: () => {},
      onNextSale: () => {},
    }),
  );

  assert.ok(html.includes("AKROS SPORTCOMPLEX"));
  assert.ok(html.includes("AKR-POS-9988"));
  assert.ok(html.includes("Carlos Santana"));
  assert.ok(html.includes("id=\"pos-print-voucher\""));
  assert.ok(html.includes("Imprimir Comprobante"));
  assert.ok(html.includes("Nueva Venta"));
});

test("TSK-FE-18 UI (SRS §11.1 Riesgo 2 / ARCH-03): PosAltLinkModal renderiza enlace y QR para celular", async () => {
  const tempUrl = "http://localhost:3000/checkout?session_id=pos_alt_123&service=Cancha&amount=56000";
  const qrUrl = await QRCode.toDataURL(tempUrl, { width: 320, margin: 2 });

  const html = renderToString(
    React.createElement(PosAltLinkModal, {
      isOpen: true,
      onClose: () => {},
      altLinkUrl: tempUrl,
      altLinkQrUrl: qrUrl,
      copiedLink: false,
      onCopyLink: () => {},
    }),
  );

  assert.ok(html.includes("Enlace de Pago Alternativo"));
  assert.ok(html.includes("Escanear con la c\u00e1mara del celular"));
  assert.ok(html.includes("id=\"pos-alt-link-input\""));
  assert.ok(html.includes("btn-copy-alt-link"));
});

test("TSK-FE-18 UI (ARCH-02 / BLOQUEANTE 2): PosVoucherModal muestra indicador de espera cuando no hay QR del servidor y no inventa QR apócrifo", () => {
  const pendingBooking: Booking = {
    id: "book-pending-1",
    code: "AKR-POS-PEND",
    client: "Carlos Santana",
    category: "canchas",
    service: "Cancha Pádel 1",
    sede: "Poblado",
    date: "2026-10-15",
    time: "08:00 a. m. - 09:00 a. m.",
    attendees: 1,
    amount: 56000,
    status: "Pendiente",
    paymentMethod: "card",
    paymentStatus: "Pendiente",
    transactionRef: "pi_pos_pending_123",
  };

  const html = renderToString(
    React.createElement(PosVoucherModal, {
      booking: pendingBooking,
      sellerName: "Andrés Muñoz",
      receiptQrUrl: null,
      onPrint: () => {},
      onNextSale: () => {},
    }),
  );

  // Debe mostrar aviso de espera y estado pendiente
  assert.ok(html.includes("Esperando confirmación de pago y emisión de pase..."));
  assert.ok(html.includes("Reserva PENDIENTE DE PAGO · Canal TAQUILLA"));
  assert.ok(html.includes("Venta en Proceso en Mostrador"));
  // NUNCA debe contener imagen de QR si el servidor no ha emitido el pase oficial
  assert.ok(!html.includes("Código QR de Acceso en Puerta"));
  assert.ok(!html.includes("AKROS_POS_VERIFIED"));
});
