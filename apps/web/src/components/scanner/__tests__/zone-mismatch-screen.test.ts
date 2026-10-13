import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

import ZoneMismatchScreen from "../ZoneMismatchScreen";

// TSK-FE-16 (HU-16 / RF-14): renderizado de la alerta roja de discrepancia de zona.

const literal =
  "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas";

function render(message: string, postServiceName?: string): string {
  return renderToStaticMarkup(
    React.createElement(ZoneMismatchScreen, {
      message,
      ticketId: "ticket-uuid-1",
      postServiceName,
      onContinue: () => {},
    }),
  );
}

test("TSK-FE-16: la pantalla muestra el literal del 403 y la zona destino destacada", () => {
  const html = render(literal, "Canchas");

  assert.ok(html.includes(literal), "Debe mostrar el texto literal del mensaje");
  assert.ok(html.includes("DIRIJA AL USUARIO A"), "Debe rotular la zona destino");
  assert.ok(html.includes("Piscina"), "Debe destacar el servicio correcto");
  assert.ok(html.includes("DENEGADO_SERVICIO"), "Debe marcar el estado de denegación");
  assert.ok(html.includes("EMITIDO"), "Debe indicar que el boleto permanece EMITIDO");
  assert.ok(
    html.includes("Entendido / Continuar escaneando"),
    "Debe ofrecer continuar escaneando",
  );
});

test("TSK-FE-16 (INVARIANTE CRÍTICO): la vista NO contiene acciones de canje", () => {
  const html = render(literal, "Canchas");

  assert.ok(!html.includes("Dar acceso"), "NO debe contener 'Dar acceso'");
  assert.ok(!html.includes("Canjear"), "NO debe contener 'Canjear'");
  assert.ok(!html.includes("Conceder"), "NO debe contener 'Conceder'");
  assert.ok(!html.includes("Registrar canje"), "NO debe contener 'Registrar canje'");
});

test("TSK-FE-16: fallback robusto si el mensaje no sigue el formato", () => {
  const html = render("El ticket pertenece a otro escenario deportivo.");

  assert.ok(
    html.includes("El ticket pertenece a otro escenario deportivo."),
    "Debe mostrar el literal aunque no sea parseable",
  );
  assert.ok(
    !html.includes("DIRIJA AL USUARIO A"),
    "Sin formato válido no debe inventar una zona destino",
  );
});
