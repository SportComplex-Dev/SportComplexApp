import test from "node:test";
import assert from "node:assert/strict";

import { parseServiceMismatch } from "@/components/scanner/service-mismatch-alert";

// TSK-FE-16: Parser del mensaje literal del 403 SERVICE_MISMATCH (TSK-BE-16).
// Formato contractual: "Acceso denegado: El tiquete pertenece a {X} y se encuentra en {Y}".

test("TSK-FE-16 (Parser zona): extrae servicio del tiquete y del puesto", () => {
  const parsed = parseServiceMismatch(
    "Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas",
  );

  assert.deepEqual(parsed, { ticketService: "Piscina", postService: "Canchas" });
});

test("TSK-FE-16 (Parser zona): extrae nombres con espacios y variantes", () => {
  const parsed = parseServiceMismatch(
    "Acceso denegado: El tiquete pertenece a Cancha 1 y se encuentra en Piscina Olímpica  ",
  );

  assert.deepEqual(parsed, {
    ticketService: "Cancha 1",
    postService: "Piscina Olímpica",
  });
});

test("TSK-FE-16 (Parser zona): devuelve null si el mensaje no sigue el formato", () => {
  assert.equal(parseServiceMismatch("Boleto ya utilizado anteriormente."), null);
  assert.equal(parseServiceMismatch(""), null);
  assert.equal(parseServiceMismatch("Acceso denegado."), null);
});
