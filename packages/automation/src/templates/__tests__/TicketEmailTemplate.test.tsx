import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  TicketEmailTemplate,
  type TicketEmailTemplateProps,
} from "../TicketEmailTemplate.js";
import { renderTicketEmail } from "../render.js";

const mockProps: TicketEmailTemplateProps = {
  customerName: "Carlos Mendoza",
  ticketCode: "TKT-AKR-9821",
  facilityName: "Pádel Panorámico 1",
  venueName: "Sede El Poblado",
  bookingDate: "24 de Octubre de 2026",
  timeSlot: "18:00 - 19:30",
  qrCodeSrc: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  totalPaid: "$ 120.000 COP",
  paymentStatus: "PAGADO (Stripe Cashless)",
};

describe("TicketEmailTemplate", () => {
  it("Test 1: Renderiza correctamente los datos del usuario, código de tiquete, fecha, franja y sede", () => {
    // Valida tanto renderToStaticMarkup sobre el componente como el helper renderTicketEmail
    const markup = renderToStaticMarkup(
      React.createElement(TicketEmailTemplate, mockProps)
    );
    const html = renderTicketEmail(mockProps);

    // Ambas salidas contienen los elementos requeridos
    assert.ok(markup.includes("¡Hola, Carlos Mendoza!"), "Debe incluir el saludo en el componente");
    assert.ok(html.includes("¡Hola, Carlos Mendoza!"), "Debe incluir el saludo con el nombre del cliente");

    // Identificadores y detalles de la reserva
    assert.ok(html.includes("TKT-AKR-9821"), "Debe contener el código de tiquete formateado");
    assert.ok(html.includes("Pádel Panorámico 1"), "Debe contener el nombre del escenario");
    assert.ok(html.includes("Sede El Poblado"), "Debe contener la sede correspondiente");
    assert.ok(html.includes("24 de Octubre de 2026"), "Debe contener la fecha del turno");
    assert.ok(html.includes("18:00 - 19:30"), "Debe contener la franja horaria");
    assert.ok(html.includes("$ 120.000 COP"), "Debe contener el total pagado");
    assert.ok(html.includes("PAGADO (Stripe Cashless)"), "Debe contener el estado del pago");

    // Identidad de marca AKROS
    assert.ok(html.includes("AKROS"), "Debe incluir la marca AKROS");
    assert.ok(html.includes("ACTIVE LIFESTYLE CLUB"), "Debe incluir el lema ACTIVE LIFESTYLE CLUB");
    assert.ok(html.includes("Reserva Confirmada • Pase Oficial"), "Debe incluir el badge de confirmación");
  });

  it("Test 2: Comprueba que el elemento de imagen del código QR esté presente con atributos src válidos (Data URI o CID) y dimensiones legibles", () => {
    // 2.a: Probar con Data URI
    const htmlWithDataUri = renderTicketEmail(mockProps);
    assert.ok(
      htmlWithDataUri.includes('src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="'),
      "Debe renderizar la imagen con el src Data URI esperado"
    );
    assert.ok(htmlWithDataUri.includes('width="220"'), "Debe incluir width=220 en el tag img");
    assert.ok(htmlWithDataUri.includes('height="220"'), "Debe incluir height=220 en el tag img");
    assert.ok(
      htmlWithDataUri.includes('alt="Código QR de Acceso Deportivo"'),
      "Debe tener texto alternativo descriptivo para accesibilidad"
    );

    // 2.b: Probar con Content-ID embebido (cid:ticket-qr)
    const propsWithCid: TicketEmailTemplateProps = {
      ...mockProps,
      qrCodeSrc: "cid:ticket-qr",
    };
    const htmlWithCid = renderTicketEmail(propsWithCid);
    assert.ok(
      htmlWithCid.includes('src="cid:ticket-qr"'),
      "Debe soportar nativamente referencias de imagen con Content-ID (cid:...)"
    );

    // Indicación operativa del QR
    assert.ok(
      htmlWithCid.includes("Presenta este código directamente en los torniquetes o al personal de portería"),
      "Debe incluir la instrucción clara de presentación en torniquetes"
    );
  });

  it("Test 3: Verifica que el HTML generado no contenga clases externas incompatibles y mantenga estructura de tabla segura y estilos inline para clientes de correo", () => {
    const html = renderTicketEmail(mockProps);

    // Estructura HTML y compatibilidad
    assert.ok(html.startsWith("<!DOCTYPE html>"), "Debe iniciar con el doctype HTML5");
    assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0"'), "Debe incluir viewport responsivo");
    assert.ok(html.includes('role="presentation"'), "Debe utilizar role=presentation en las tablas para accesibilidad y clientes");
    assert.ok(html.includes("max-width:600px") || html.includes("max-width: 600px"), "Debe tener un ancho máximo de 600px centrado");

    // No debe contener clases CSS externas incompatibles
    assert.ok(
      !html.includes('class="'),
      "El HTML generado para clientes de correo no debe depender de atributos class externos"
    );

    // Debe contener estilos inline esenciales
    assert.ok(html.includes("background-color:#123e30") || html.includes("background-color: #123e30"), "Debe tener el color verde institucional en inline");
    assert.ok(html.includes("background-color:#c9ef75") || html.includes("background-color: #c9ef75"), "Debe tener el lima cinético en inline");
  });

  it("Test 4: Valida la inclusión de las normas esenciales de acceso y enlace de soporte", () => {
    const html = renderTicketEmail(mockProps);

    // Normas de acceso
    assert.ok(html.includes("Normas esenciales de acceso"), "Debe contener la sección de normas de acceso");
    assert.ok(html.includes("10 minutos de tiempo de gracia"), "Debe indicar los 10 minutos de tiempo de gracia");
    assert.ok(html.includes("Calzado deportivo adecuado"), "Debe indicar el calzado deportivo adecuado");
    assert.ok(html.includes("Acceso personal e intransferible"), "Debe indicar que el acceso es personal e intransferible");

    // Canales de soporte y datos de sede
    assert.ok(html.includes("Sede El Poblado"), "Debe detallar la dirección de Sede El Poblado");
    assert.ok(html.includes("Sede Laureles"), "Debe detallar la dirección de Sede Laureles");
    assert.ok(html.includes("WhatsApp Concierge Deportivo"), "Debe incluir el canal de WhatsApp Concierge");
    assert.ok(html.includes("https://wa.me/573000000000"), "Debe incluir el link de WhatsApp");
    assert.ok(html.includes("soporte@sportcomplex.club"), "Debe incluir el correo de soporte");
  });
});
