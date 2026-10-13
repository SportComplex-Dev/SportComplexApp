import test from "node:test";
import assert from "node:assert/strict";
import { parseZoneMismatch } from "../scanner.service";

// TSK-FE-16 (HU-16 / RF-14): parser del mensaje literal del 403 SERVICE_MISMATCH.

test("TSK-FE-16: parseZoneMismatch extrae ambos servicios del formato estándar", () => {
  assert.deepEqual(
    parseZoneMismatch("Acceso denegado: El tiquete pertenece a Piscina y se encuentra en Canchas"),
    { ticketService: "Piscina", postService: "Canchas" },
  );
});

test("TSK-FE-16: parseZoneMismatch soporta nombres con espacios y tildes", () => {
  assert.deepEqual(
    parseZoneMismatch(
      "Acceso denegado: El tiquete pertenece a Cancha Sintética 1 y se encuentra en Piscina Semiolímpica",
    ),
    { ticketService: "Cancha Sintética 1", postService: "Piscina Semiolímpica" },
  );
});

test("TSK-FE-16: parseZoneMismatch devuelve null si el mensaje no sigue el formato", () => {
  assert.equal(parseZoneMismatch("El ticket pertenece a otro escenario deportivo."), null);
  assert.equal(parseZoneMismatch(""), null);
  assert.equal(parseZoneMismatch("Acceso denegado."), null);
});
