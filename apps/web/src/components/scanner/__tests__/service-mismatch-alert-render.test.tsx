import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).React = React;

import { ServiceMismatchAlert } from "@/components/scanner/service-mismatch-alert";

// TSK-FE-16: Renderizado visual de la alerta roja de discrepancia de zona (HU-16 / RF-14).

const literal403 =
  "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas";

test("VISUAL TSK-FE-16: muestra alerta roja con el literal del 403 y la zona destacada", () => {
  const html = renderToStaticMarkup(
    <ServiceMismatchAlert message={literal403} postServiceName="Canchas" />,
  );

  // 1. Alerta roja accesible
  assert.ok(html.includes('role="alert"'), "Debe exponer role=alert");
  assert.ok(html.includes("Discrepancia de zona"), "Debe titular la discrepancia");

  // 2. Texto literal del mensaje íntegro
  assert.ok(
    html.includes("El tiquete pertenece a Piscina y se encuentra en Canchas"),
    "Debe mostrar el texto literal del 403",
  );

  // 3. Servicio correcto destacado para lectura de un vistazo
  assert.ok(html.includes("Dirija al usuario a"), "Debe indicar a dónde dirigir al usuario");
  assert.ok(html.includes("<strong>Piscina</strong>"), "Debe destacar la zona destino");
  assert.ok(html.includes("Puesto actual"), "Debe mostrar el puesto actual como contexto");
});

test("VISUAL TSK-FE-16 (INVARIANTE): sin acciones de canje en la alerta", () => {
  const html = renderToStaticMarkup(<ServiceMismatchAlert message={literal403} />);

  assert.ok(!html.includes("Dar Acceso"), "NO debe contener 'Dar Acceso'");
  assert.ok(!html.includes("Canjear"), "NO debe contener 'Canjear'");
  assert.ok(!html.includes("Consumir"), "NO debe contener 'Consumir'");
});

test("VISUAL TSK-FE-16: usa el puesto del mensaje si no se provee postServiceName", () => {
  const html = renderToStaticMarkup(<ServiceMismatchAlert message={literal403} />);

  assert.ok(html.includes("<strong>Piscina</strong>"), "Debe destacar la zona destino");
  assert.ok(html.includes("Canchas"), "Debe mostrar el puesto extraído del mensaje");
});

test("VISUAL TSK-FE-16: fallback robusto ante mensaje sin formato", () => {
  const html = renderToStaticMarkup(
    <ServiceMismatchAlert message="Boleto ya utilizado anteriormente." />,
  );

  assert.ok(html.includes('role="alert"'), "Debe mantener la alerta roja");
  assert.ok(
    html.includes("Boleto ya utilizado anteriormente."),
    "Debe mostrar el mensaje literal",
  );
  assert.ok(
    !html.includes("Dirija al usuario a"),
    "Sin formato válido no debe inventar una zona destino",
  );
});
